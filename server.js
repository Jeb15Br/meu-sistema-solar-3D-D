const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 4000;

const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav'
};

const server = http.createServer((req, res) => {
    // Decode the URL to handle spaces (%20)
    let requestedUrl = decodeURIComponent(req.url.split('?')[0]);
    if (requestedUrl === '/') requestedUrl = 'index.html';

    let filePath = path.join(__dirname, requestedUrl);

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404);
                res.end('File not found');
            } else {
                res.writeHead(500);
                res.end('Server error: ' + error.code);
            }
        } else {
            const ext = path.extname(filePath).toLowerCase();
            res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
            res.end(content, 'utf-8');
        }
    });
});

server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
        console.log('Port ' + PORT + ' in use, retrying...');
        setTimeout(() => {
            server.close();
            server.listen(PORT + 1);
        }, 1000);
    }
});

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
});
