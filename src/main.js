const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const express = require('express');

const app = express();
const port = 3000;

const sourceFolder = path.join(__dirname, 'images');
const destinationFolder = path.join(__dirname, 'compressed_images');

app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/sse', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  processAndSendUpdates(res);
});

const processAndSendUpdates = (res) => {
  if (!fs.existsSync(destinationFolder)) {
    fs.mkdirSync(destinationFolder);
  }

  fs.readdir(sourceFolder, async (err, files) => {
    if (err) {
      console.error('Error reading source folder:', err);
      return;
    }

    for (const file of files) {
      const timestamp = new Date().getTime();
      const sourceFilePath = path.join(sourceFolder, file);
      const destinationFileName = path.basename(file, path.extname(file)) + '-' + timestamp + '.webp';
      const destinationFilePath = path.join(destinationFolder, destinationFileName);

      const readStream = fs.createReadStream(sourceFilePath);
      const writeStream = fs.createWriteStream(destinationFilePath);

      try {
        const sharpStream = sharp().webp({ quality: 20 });

        // Get the initial size of the source file
        const sourceStats = fs.statSync(sourceFilePath);
        const initialSize = sourceStats.size;

        readStream.pipe(sharpStream).pipe(writeStream);

        await new Promise((resolve, reject) => {
          writeStream.on('finish', resolve);
          writeStream.on('error', reject);
        });

        // Get the size of the compressed file
        const compressedStats = fs.statSync(destinationFilePath);
        const compressedSize = compressedStats.size;

        // Send update via SSE
        res.write(`data: Image: ${file}, Initial Size: ${initialSize} bytes, Compressed Size: ${compressedSize} bytes\n\n`);
      } catch (error) {
        console.error(`Error processing image ${file}: ${error}`);
        // Send an error message via SSE
        res.write(`data: Error processing image ${file}: ${error}\n\n`);
      }
    }
  });
}

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}/`);
});
