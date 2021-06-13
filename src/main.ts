require('dotenv').config();
import express from 'express';
import {URL} from 'url';
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import https from 'https';
import fs from 'fs';



const app = express();
const port = 80;

const getTpeapSessionCookie = (headers :any)  : string => {
    const setCookie = headers['set-cookie'];

    let tpeapSessionCookieRaw = '';
    for( let i = 0; i < setCookie.length; i++) {
        if(setCookie[i].includes('TPEAP_SESSIONID')) {
            tpeapSessionCookieRaw = setCookie[i];
            break;
        }
    }

    const parts = tpeapSessionCookieRaw.split(';')

    return parts[0];
}


app.get('/', (req, res) => {

    res.sendFile(__dirname +  '/assets/index.html');

});

app.get('/main.css', (req, res) => {
    res.sendFile(__dirname + '/assets/main.css');
});

app.get('/logo.png', (req, res) => {
    res.sendFile(__dirname + '/assets/logo.png');
});

app.get('/login', async (req, res) => {
    try {
        const sessionDuration = 60 * 60 * 24 * parseInt(process.env.SESSION_DURATION_DAYS || '14');
        const eapControllerIp = process.env.CONTROLER_IP;
        const eapControllerPort = process.env.CONTROLER_PORT;

        const reffer = req.headers['referer'] || '';
        const refferUrl = new URL(reffer);
        const refPara : URLSearchParams = refferUrl.searchParams;

        if(!refPara.has('cid')) {
            throw new Error("No cid presend");
        }

        const requestTime = parseInt(refPara.get('t') || '0');
        const sessionTillTime = requestTime + sessionDuration;


        const authParams : string = `cid=${refPara.get('cid')}&ap=${refPara.get('ap')}&ssid=${refPara.get('ssid')}&rid=${refPara.get('rid')}&t=${refPara.get('t')}&time=${sessionTillTime}`;

        const actualSite = refPara.get('site');


        // Login
        const loginConfig : AxiosRequestConfig = {
            httpsAgent : new https.Agent({rejectUnauthorized: false})
        }

        const loginUrl : string = `https://${eapControllerIp}:${eapControllerPort}/login`;
        const loginData : string = `name=${process.env.CONTROLER_US}&password=${process.env.CONTROLER_PW}`
        const loginResponse : AxiosResponse = await axios.post(loginUrl, loginData, loginConfig);

        const csrfToken = loginResponse.data['value'];
        const tpeapSessionCookie = getTpeapSessionCookie(loginResponse.headers);

        // Authenticate client
        const authConfig : AxiosRequestConfig = {
            httpsAgent : new https.Agent({rejectUnauthorized: false}),
            headers : {
                Cookie: tpeapSessionCookie,
            }
        }

        const authUrl : string = `https://${eapControllerIp}:${eapControllerPort}/extportal/${actualSite}/auth?token=${csrfToken}`;
        const authResponse : AxiosResponse = await axios.post(authUrl, authParams, authConfig);
        

        // Logout allways return 404
        /*
        const logoutConfig : AxiosRequestConfig = {
            httpsAgent : new https.Agent({rejectUnauthorized: false}),
            headers : {
                Cookie: tpeapSessionCookie,
            }
        }

        const logoutUrl : string = `https://${eapControllerIp}:${eapControllerPort}/logout?token=${csrfToken}`;
        const logoutResponse : AxiosResponse = await axios.post(logoutUrl, '', logoutConfig);
        */

        const mailAddress = String(req.query.email);
        fs.appendFileSync('src/assets/emails.txt', mailAddress+'\r\n');

        // console.log(authResponse.data.message);
        // console.log(mailAddress);
        
        //res.send('ok');
        res.redirect(301, refPara.get('redirectUrl') || '/sucess');
    }
    catch (e) {
        console.log(e);
        res.send('400 Error');
    }
});

app.get('/sucess', (req, res) => {
    res.send('Sucess');
});

app.get('/adressen', (req, res) => {

    if(req.query['pw'] === process.env.MAIL_DOWNLOAD_PW) {
        res.sendFile(__dirname +  '/assets/emails.txt');
    } else {
        res.send('Auth Failed');
    }

});

app.listen(port, () => {
    console.log('server started');
});