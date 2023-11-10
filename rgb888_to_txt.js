const Jimp = require('jimp');
const fs = require('fs');

// Input JPEG file path
const inputFilePath = 'input.jpg';

// Output text file path
const outputFilePath = 'output.rgb888.txt';

// Load the JPEG image
Jimp.read(inputFilePath)
  .then((image) => {
    // Get the image dimensions
    const width = image.bitmap.width;
    const height = image.bitmap.height;

    // Initialize a string to hold the RGB888 data
    let rgb888Data = '';

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pixel = Jimp.intToRGBA(image.getPixelColor(x, y));
        // Append the RGB888 values to the string, separated by spaces
        rgb888Data += `${pixel.r} ${pixel.g} ${pixel.b} `;
      }
      // Add a line break at the end of each row
      rgb888Data += '\n';
    }

    // Save the RGB888 data to a text file
    fs.writeFile(outputFilePath, rgb888Data, (err) => {
      if (err) throw err;
      console.log(`RGB888 data saved as ${outputFilePath}`);
    });
  })
  .catch((err) => {
    console.error(err);
  });