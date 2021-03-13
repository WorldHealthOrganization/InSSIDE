import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { InitService } from 'src/services/init.service';
import { AuthenticationService } from 'src/services/authentication.service';
@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {
  // Table
  headers = ['Property', 'Sensitive Data'];
  decryptedData = {};

  hidePrivKey: boolean;
  /* public sensitiveData = ["firstName","middleName","lastName","addresses,phoneNumber"] */
  userActive: boolean;
  decryptForm: FormGroup;
  transferForm: FormGroup;
  constructor(
    private formBuilder: FormBuilder,
    private initService: InitService,
    private authenticationService: AuthenticationService
  ) { }

  ngOnInit(): void {
    this.userStatus();
    this.decryptForm = this.formBuilder.group({
      hashId: ['', [Validators.required]]
    });
    this.transferForm = this.formBuilder.group({
      usernameToTranfer: ['', [Validators.required]]
    });
  }

  get fdecryptForm() { return this.decryptForm.controls; }
  get ftransferForm() { return this.transferForm.controls; }

  userStatus() {

    const userData = this.authenticationService.currentUserValue;
    if (userData == null) {
      this.userActive = false;
    }
    else {
      this.userActive = true;
    }
  }
  copyToClipboard() {

  }
  getKey() {
    if (this.fdecryptForm.hashId.value != '' ) {

      const username = JSON.parse(localStorage.getItem('user')).username;
      console.log('USERNAME ' + username);
      const getKeyJSON = {
        username,
        hashId: this.fdecryptForm.hashId.value,
      };
      this.initService.getKey(getKeyJSON).subscribe(
        data => {
          console.log('RECEIVED');
            /* let res = JSON.stringify(data) */
          console.log(data);
            /* let key = this.decryptSymKey(data.keyUsed)
            this.decryptCase(key,data) */
       },
       error => {
           alert(error.message);
       });
    }
    else {
      alert('Error: HashId Required');
    }
  }
  decryptCase(){
    //donothig...
  }
  /* decryptSymKey(keyEncrypted: bigint){
    console.log(keyEncrypted);
    let privUser = JSON.parse(localStorage.getItem('key'));
    let symmetricKey : bigint = bigintCryptoUtils.modPow(keyEncrypted, privUser.privateexp,privUser.publicmod )
    console.log(bigintToText(symmetricKey))
    return bigintToText(symmetricKey);
  } */
  /*
  decryptCase() {

    // stop here if form is invalid
    if (this.fdecryptForm.invalid || this.ftransferForm.invalid) {
        return;
    }

     this.loading = true; 
    const decryptJSON = {
      username: JSON.parse(localStorage.getItem('user')).username,
      hashId: this.fdecryptForm.hashId.value
    };

    this.initService.decryptCase(decryptJSON).subscribe(
       data => {

         console.log(`Recieved Decrypted Data \n`, data);

        // we have the decrypted data
         this.decryptedData = data.message;
        /*
        console.log("After parsing");
        console.log(this.decryptCase);
        

      },
      error => {
          alert(error.message);
           this.loading = false; 
      });
}
   decryptCase(key: string, data:any){
    let username;
     if(data.isTheCreator == "y"){
      username = JSON.parse(localStorage.getItem('user')).username
     }
    else{ //If is not the creator we need to split by the email of the creator that is sended from backend
      username = data.emailCreator
    }

    console.log(data.spCase)
    this.sensitiveData.forEach(element => {
      var isDocument = element.split(",").length; //If there is a document we have address,phoneNumber
      if (isDocument == 1) {
        //If the beggining of the value is equal to /ENC/ we decrypt the field
        if (data.spCase[element].substring(0, 5) == "/ENC/") {
          var toSplit = data.spCase[element]; //Because we need to take only the field encrypted not the /ENC/creator
          var splittedField = toSplit.split("/"+username+"/");
          let valueToDecrypt = splittedField[1];
          let decryptedField: String = this.decrypt(valueToDecrypt, key);
          data.spCase[element] = decryptedField
        }
      }
      else {
        if (data.spCase[element.split(",")[0]][0][element.split(",")[1]].substring(0, 5) == "/ENC/") {
          var toSplit = data.spCase[element.split(",")[0]][0][element.split(",")[1]] //Because we need to take only the field encrypted not the /ENC/creator
          var splittedField = toSplit.split("/"+username+"/");
          let valueToDecrypt = splittedField[1]
          let decryptedField: String = this.decrypt(valueToDecrypt, key);
          data.spCase[element.split(",")[0]][0][element.split(",")[1]] = decryptedField
        }
      }
    });
     //Finally decrypt CIP
     let positionCIP: number = 0;
     while (data.spCase["documents"][positionCIP]["type"] != "LNG_REFERENCE_DATA_CATEGORY_DOCUMENT_TYPE_CIP") {
       positionCIP = positionCIP + 1;
     }
     let FullCIPToDecrypt = data.spCase["documents"][positionCIP]["number"]
     var splittedField = FullCIPToDecrypt.split("/"+username+"/");
     let CIPToDecrypt = splittedField[1]
     let decryptedField: String = this.decrypt(CIPToDecrypt, key);
     data.spCase["documents"][positionCIP]["number"] = decryptedField

     //WE ADD IT TO THE TABLE

     this.rows.push({
      "CIP": data.spCase["documents"][positionCIP]["number"],
      "Fullname": data.spCase["firstName"]+" " + data.spCase["middleName"]+" "  + data.spCase["lastName"],
      "Phone Number": data.spCase["addresses"][0]["phoneNumber"]
    })

  } */
  /* private decrypt(element: any, key: string): String {
    var decrypted = CryptoJS.AES.decrypt(element, key).toString(CryptoJS.enc.Utf8);
    return decrypted;
  } */
  /* hidePrivateKey(){
    this.hidePrivKey = !this.hidePrivKey
  } */

  shareAccesToHospitals(){
    if ((this.fdecryptForm.hashId.value != '') && (this.ftransferForm.usernameToTranfer.value != '')) {
      const username = JSON.parse(localStorage.getItem('user')).username;
      console.log('Username: ' + username + ' usernameToTransfer: ' + this.ftransferForm.usernameToTranfer.value);
      const transferPermissionJSON = {
        username,
        hashId: this.fdecryptForm.hashId.value,
        usernameToTransfer: this.ftransferForm.usernameToTranfer.value
      };
      this.initService.transferKey(transferPermissionJSON).subscribe(
        data => {
          console.log('RECEIVED');
          const res = JSON.stringify(data);
          alert('Case license transfer sucessfull!');
       },
       error => {
           alert(error.message);
       });
    }
    else {
      alert('Error: hashId and Destination Hospital Required');
    }
  }
}
