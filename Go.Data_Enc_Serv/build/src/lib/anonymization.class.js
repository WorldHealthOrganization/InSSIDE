"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = __importDefault(require("crypto"));
const user_1 = __importDefault(require("../models/user"));
const config_1 = __importDefault(require("../configurations/config"));
const godataLicense_1 = __importDefault(require("../models/godataLicense"));
const cipherRSA_1 = __importDefault(require("../helpers/cipherRSA"));
const goDataHelper_1 = __importDefault(require("../helpers/goDataHelper"));
const cipherAES_1 = __importDefault(require("../helpers/cipherAES"));
const Bcrypt = require('bcrypt');
/**
 * Encrypts all of the case, under admin
 * But remember to configure the config.ts properly
 * with the GoData username,password and the outbreak
 * which requires protection.
 * Examples:
 *
 *    localhost:3000/encrypt
 *
 */
function encryptCases(cases) {
    return new Promise(async (resolve, reject) => {
        //for all the cases we encrypt if is needed the sensible data
        let fieldsModified = 0;
        for (let i = 0; i < cases.length; i++) {
            //console.log("STEP0 --> CASE: " + cases[i])
            //First we need to know who have added this case to Go.Data and generate the hash of the case
            //let creator = cases[i].createdBy;
            let creator = await goDataHelper_1.default.getInstituteCreator(cases[i].createdBy);
            console.log("STEP1 --> Institution CREATOR: " + creator);
            let encryptionKey = crypto_1.default.randomFillSync(Buffer.alloc(32)).toString('base64');
            let iv = crypto_1.default.randomBytes(config_1.default.IV_LENGTH);
            console.log("STEP2 --> ENCRYPTION KEY: " + encryptionKey);
            // All cases must be anonymized & so the sensitive field
            // defined in the config.ts must be encrypted
            // First we go over each sensitive field, search in the case for the field and encrypt
            config_1.default.sensitiveData.forEach(sensitiveField => {
                let sensitiveFieldLength = sensitiveField.split(",").length; //If there is a subSensitiveField like  address,phoneNumber
                if (sensitiveFieldLength == 1) { //We don't need to split because sensitiveField doesn't have subSensitiveField
                    // If the beginning of the value is different of /ENC
                    // (so it has not been encrypted yet) we encrypt the field and add /ENC/creatorEmail at the beggining
                    if (cases[i][sensitiveField].substring(0, 5) != "/ENC/") {
                        fieldsModified = 1; //Field Modified
                        let encryptedField = cipherAES_1.default.encryptSymmetric(cases[i][sensitiveField], encryptionKey, iv);
                        /*console.log(encryptedField);*/
                        cases[i][sensitiveField] = "/ENC/" + creator + "/" + encryptedField;
                    }
                    else {
                        return;
                    }
                }
                else { //had sensitiveField configured in config with internal subfields of the objects stored in a array
                    let subSensitiveField = sensitiveField.split(",");
                    // Documents which contains a list of documents such as nationality, archived_id etc, so
                    // need to go over each document and encrypt the number of that document which we want to protect
                    // Also applies for addresses, which might contain phone and addresses
                    let fieldObjectsLength = cases[i][subSensitiveField[0]].length;
                    for (let subSensitiveFields = 0; subSensitiveFields < fieldObjectsLength; subSensitiveFields++) {
                        if (cases[i][subSensitiveField[0]][subSensitiveFields][subSensitiveField[1]].substring(0, 5) != "/ENC/") { //if is not encrypted
                            fieldsModified = 1; //SetModified
                            let fieldNeededEncryption = cases[i][subSensitiveField[0]][subSensitiveFields][subSensitiveField[1]];
                            let encryptedField = cipherAES_1.default.encryptSymmetric(fieldNeededEncryption, encryptionKey, iv);
                            /*console.log(encryptedField)*/
                            cases[i][subSensitiveField[0]][subSensitiveFields][subSensitiveField[1]] = "/ENC/" + creator + "/" + encryptedField;
                        }
                    }
                }
            });
            if (fieldsModified != 0) {
                // We update only the cases where we have encrypted data, and if the key save was success
                // we don't want to update case, if the key is not saved. As impossible to recover...
                // Only update if key encryption didn't fail --> await this.updateCase(cases[i]);
                let keys;
                //We encrypt the key with the RSA Keys of Admin user and same for the Hospital
                user_1.default.findOne({ username: "admin" }).then((managerUser) => {
                    if (managerUser != null) {
                        // Now hash the CIP, as this will provide the merge capability between same cases from different hospital
                        // without needing to decrypt the actual information of the patient/case
                        let positionCIP = 0;
                        while (cases[i]["documents"][positionCIP]["type"] != "LNG_REFERENCE_DATA_CATEGORY_DOCUMENT_TYPE_CIP") {
                            positionCIP = positionCIP + 1;
                            if (positionCIP == cases[i]["documents"].length) {
                                return reject({ message: "Case not encrypted, need to provide valid CIP for all cases!", statusCode: 400 });
                            }
                        }
                        let fullFieldsToHash = cases[i]["documents"][positionCIP]["number"].toUpperCase();
                        let cipHash = Bcrypt.hashSync(fullFieldsToHash, config_1.default.saltRounds);
                        cases[i]["documents"][cases[i]["documents"].length] = {
                            "type": "LNG_REFERENCE_DATA_CATEGORY_DOCUMENT_TYPE_OTHER",
                            "number": cipHash
                        };
                        let keyEncrypted = cipherRSA_1.default.encryptKeyRSA(managerUser.publicKey, encryptionKey);
                        //Hospital, if the hospital does not exist in our DB we only save the keys of the admin
                        keys = [
                            {
                                hospitalName: "admin",
                                usedKey: keyEncrypted
                            }
                        ];
                        const newGoDataLicenseCase = new godataLicense_1.default({
                            caseId: cases[i]['id'],
                            cipHash: cipHash,
                            creatorEmail: creator,
                            keys: keys
                        }); //New entry in our DRM server to store the keys
                        /*console.log("STEP7 --> new Entry: " + newGoDataLicenseCase)*/
                        newGoDataLicenseCase.save().then((data) => {
                            //Update the data in GoData when actually everything correct!!!!
                            goDataHelper_1.default.updateCase(cases[i]).then((_) => {
                                return resolve({ message: "Encrypted", statusCode: 200 });
                            });
                        }).catch((err) => {
                            console.log(err);
                            return reject({ message: "Case not encrypted:  " + err, statusCode: 500 });
                        });
                    }
                    else {
                        console.log("Failed trying to encrypt the case Key for admin user, admin not found in database!");
                        return reject({ message: "Case not encrypted, admin not found", statusCode: 500 });
                    }
                }).catch((err) => {
                    console.log("Failed trying to encrypt the case Key for admin user: " + err.message);
                    return reject({ message: "Failed trying to encrypt the case Key for admin user:  " + err, statusCode: 500 });
                });
                //Resetting for next case!
                fieldsModified = 0; //Reset
            }
        }
    });
}
/**
 * Decrypts the case, given username(token:Future) and caseId
 * Examples:
 *
 *    {"caseId":"bla-bla-bla","username":"admin"}
 *
 */
function decryptCases(username, caseId) {
    return new Promise((resolve, reject) => {
        //Once we have the case we need to check to get the key to decrypt that is encrypted with pubkey of Hosp
        let decryptedCaseWithSensitiveFields = { caseId: caseId };
        //Once we have the hash we need to find the key for the case that is already stored in the client with the getKey
        //Just for test we put the key already decrypted
        //keyDecrypted = af44f60c2c308c7904abaa211970c63201114eaf6a0ede5724b3fd9506967da9
        user_1.default.findOne({ username: username }).then((hospitalUser) => {
            if (hospitalUser != null) {
                godataLicense_1.default.findOne({ caseId: caseId }).then((goDataLicense) => {
                    if (goDataLicense != null) {
                        // GoDataLicense found...
                        let i = 0;
                        // Find where the hospitalName is equal to username, inside the licenses...
                        while (goDataLicense.keys[i].hospitalName.toString() != username) {
                            i = i + 1;
                            if (goDataLicense.keys.length == i) {
                                return reject({ message: "Don't have permission for the case", statusCode: 404 });
                            }
                        }
                        if (goDataLicense.keys[i].hospitalName.toString() == username) {
                            //We will return the key encrypted with the public key, so only the
                            // hospital or user with private key can decrypt and get the symmetric key!
                            /*const encrypt: EncryptCases = new EncryptCases;*/
                            goDataHelper_1.default.getCase(caseId).then((spCase) => {
                                if (spCase.error == null) {
                                    //No error in the response, means correct result
                                    //Both username and case exists
                                    let encryptedKey = goDataLicense.keys[i].usedKey;
                                    //let encryptedBufferKey:Buffer = new Buffer(encryptedKey, 'base64');
                                    let keyDecrypted = cipherRSA_1.default.decryptKeyRSA(hospitalUser.privateKey, encryptedKey);
                                    console.log("key Decrypted: " + keyDecrypted);
                                    let tes = config_1.default.sensitiveData;
                                    //Decrypting
                                    config_1.default.sensitiveData.forEach(sensitiveField => {
                                        let subSensitiveField = sensitiveField.split(",");
                                        //If there is a document we have address,phoneNumber
                                        if (subSensitiveField.length == 1) {
                                            //If the beginning of the value is equal to /ENC/ we decrypt the field
                                            if (spCase[sensitiveField].substring(0, 5) == "/ENC/") {
                                                let sensitiveFieldValueSplit = spCase[subSensitiveField[0]].split("/");
                                                let offsetEncryptedFieldValue = sensitiveFieldValueSplit[1].length + sensitiveFieldValueSplit[2].length + 3;
                                                let encryptedFieldValue = spCase[subSensitiveField[0]].substring(offsetEncryptedFieldValue);
                                                /*let valueToDecrypt = spCase[sensitiveField].substring(42,)*/ //from 42 because after /ENC/ we have the id of the creator
                                                let decryptedField = cipherAES_1.default.decryptSymmetric(encryptedFieldValue, keyDecrypted);
                                                //spCase[sensitiveField] = decryptedField
                                                decryptedCaseWithSensitiveFields[sensitiveField] = decryptedField;
                                            }
                                        }
                                        else {
                                            // Has sensitiveField configured in config with internal subfields of the objects stored in a array
                                            // Documents which contains a list of documents such as nationality, archived_id etc, so
                                            // need to go over each document and encrypt the number of that document which we want to protect
                                            // Also applies for addresses, which might contain phone and addresses
                                            /*let fieldObjectsLength = spCase[subSensitiveField[0]].length;
                                            for (let subSensitiveFields = 0; subSensitiveFields < fieldObjectsLength; subSensitiveFields++) {*/
                                            spCase[subSensitiveField[0]].forEach((spCaseSubObject, index) => {
                                                if (!(subSensitiveField[0] == "documents" && spCaseSubObject["type"].toString() == "LNG_REFERENCE_DATA_CATEGORY_DOCUMENT_TYPE_OTHER")) {
                                                    let sensitiveFieldValueSplit = spCaseSubObject[subSensitiveField[1]].split("/");
                                                    let offsetEncryptedFieldValue = sensitiveFieldValueSplit[1].length + sensitiveFieldValueSplit[2].length + 3;
                                                    let encryptedFieldValue = spCaseSubObject[subSensitiveField[1]].substring(offsetEncryptedFieldValue);
                                                    if (sensitiveFieldValueSplit[1] == "ENC") { //if is encrypted
                                                        let decryptedField = cipherAES_1.default.decryptSymmetric(encryptedFieldValue, keyDecrypted);
                                                        //spCase[subSensitiveField[0]][subSensitiveFields][subSensitiveField[1]] = decryptedField;
                                                        if (subSensitiveField[0] == "documents") {
                                                            let documentTypeSplit = spCaseSubObject["type"].split("_");
                                                            let documentType = documentTypeSplit.splice(6, documentTypeSplit.length - 1).join('');
                                                            decryptedCaseWithSensitiveFields[documentType] = decryptedField;
                                                        }
                                                        else {
                                                            decryptedCaseWithSensitiveFields[subSensitiveField[1]] = decryptedField;
                                                        }
                                                    }
                                                }
                                            });
                                            /*}*/
                                        }
                                    });
                                    return resolve({ message: decryptedCaseWithSensitiveFields, statusCode: 200 });
                                }
                                else {
                                    return reject({ message: "Case not found, erroneous id!", statusCode: 404 });
                                }
                            }).catch((err) => {
                                //Some error, can't retrieve case
                                console.log(err);
                                return reject({ message: "Server error, while trying to find case!", statusCode: 500 });
                            });
                        }
                        else {
                            // User hasn't got permission to view the case nether the key
                            return reject({ message: "Don't have permission for the case", statusCode: 404 });
                        }
                    }
                    else {
                        return reject({ message: "Case not found, erroneous id!", statusCode: 404 });
                    }
                }).catch((err) => {
                    console.log("Error while getting GoDataLicense " + err);
                    return reject({ message: "Server error, please try again", statusCode: 500 });
                });
            }
            else {
                return reject({ message: "User doesn't exist", statusCode: 404 });
            }
        }).catch((err) => {
            return reject({ message: "Server error, please check the fields are as required", statusCode: 500 });
        });
    });
}
exports.default = {
    encryptCases,
    decryptCases
};
