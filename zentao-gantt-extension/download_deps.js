const https = require('https');
const fs = require('fs');
const path = require('path');

const files = [
    {
        url: 'https://cdn.dhtmlx.com/gantt/edge/dhtmlxgantt.js',
        path: 'js/dhtmlxgantt.js'
    },
    {
        url: 'https://cdn.dhtmlx.com/gantt/edge/dhtmlxgantt.css',
        path: 'css/dhtmlxgantt.css'
    }
];

function downloadFile(url, filepath) {
    return new Promise((resolve, reject) => {
        https.get(url, (response) => {
            if (response.statusCode === 200) {
                response.pipe(fs.createWriteStream(filepath))
                    .on('error', reject)
                    .once('close', () => resolve(filepath));
            } else {
                response.resume();
                reject(new Error(`Request Failed With a Status Code: ${response.statusCode}`));
            }
        });
    });
}

async function downloadAll() {
    for (const file of files) {
        try {
            console.log(`Downloading ${file.url}...`);
            await downloadFile(file.url, path.join(__dirname, file.path));
            console.log(`Downloaded ${file.path}`);
        } catch (error) {
            console.error(`Error downloading ${file.url}:`, error);
        }
    }
}

downloadAll(); 