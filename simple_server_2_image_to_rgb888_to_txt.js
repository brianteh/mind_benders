const Module = require('./edge-impulse-standalone');
const express = require('express');
const sharp = require('sharp');// image processing library
const bodyParser = require('body-parser');

const app = express();
const port = 3000; // port

app.use(bodyParser.raw({ type: 'image/jpeg', limit: '200mb' }));

// Middleware to measure response time
app.use((req, res, next) => {
    const start = performance.now();

    res.on('finish', () => {
        const end = performance.now();
        const responseTime = end - start;
        console.log(`Response time: ${responseTime.toFixed(2)} milliseconds`);
    });

    next();
});

// Route to receive an image via HTTP POST
app.post('/upload_image',(req, res) => {
  if (!req.body) {
    return res.status(400).json({ error: 'No image data received' });
  }

  // Save image as jpeg
  let ind = getRandomInt(1,1000);
  sharp(req.body)
  .toFormat('jpeg')
  .toFile(`img_${ind}.jpeg`,(err,info)=>{
      if (err) {
          console.error(err);
      } else {
          console.log(`image ${ind} saved!`);
      }
  });

  // Convert the image to RGB888 format
  sharp(req.body)
    .raw()
    .resize(160,160)
    .toBuffer((err, data) => {
       
        if (err) {
            return res.status(500).json({ error: 'Image processing error' });
        }

        let raw_features = convertToText(data,160); // in 0xFFFFFF format , width-->160

        let classifier = new EdgeImpulseClassifier();
        classifier.init().then(async () => {
            let project = classifier.getProjectInfo();
            console.log('Running inference for', project.owner + ' / ' + project.name + ' (version ' + project.deploy_version + ')');

            let result = classifier.classify(raw_features.trim().split(',').map(n => Number(n)));

            console.log(result);
            
            
            return res.status(200).json({status:1,result});
            
            
        }).catch(err => {
            console.error('Failed to initialize classifier', err);
            return res.status(500).json({error: "Failed to initialized classifier"});
            
            
        });


    });

   
    
   
    
    
        

    
    
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

// misc func
function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min) + min);
}
  
// START OF TEMPLATE CODE

// Define a function to convert RGB888 to a text representation
function convertToText(rgb888Data,width) {
    let textData = '';
  
    // Loop through the RGB888 data in bytes (3 bytes per pixel)
    for (let i = 0; i < rgb888Data.length; i += 3) {
      const r = rgb888Data[i];
      const g = rgb888Data[i + 1];
      const b = rgb888Data[i + 2];
  
      // Check the color values and assign a representation
      if (r === 255 && g === 255 && b === 255) {
        textData += '0xFFFFFF'; // White
      } else {
        // Add your custom representation here or use the RGB values
        textData += `0x${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
      }
  
      // Add a space or newline to separate values
      if (i + 3 < rgb888Data.length) {
        if ((i / 3 + 1) % width === 0) {
          textData += '\n';
        } else {
          textData += ',';
        }
      }
    }
  
    return textData;
}



// Classifier module
let classifierInitialized = false;
Module.onRuntimeInitialized = function() {
    classifierInitialized = true;
};

class EdgeImpulseClassifier {
    _initialized = false;

    init() {
        if (classifierInitialized === true) return Promise.resolve();

        return new Promise((resolve) => {
            Module.onRuntimeInitialized = () => {
                classifierInitialized = true;
                Module.init();
                resolve();
            };
        });
    }

    getProjectInfo() {
        if (!classifierInitialized) throw new Error('Module is not initialized');
        return Module.get_project();
    }

    classify(rawData, debug = false) {
        if (!classifierInitialized) throw new Error('Module is not initialized');

        let props = Module.get_properties();

        const obj = this._arrayToHeap(rawData);
        let ret = Module.run_classifier(obj.buffer.byteOffset, rawData.length, debug);
        Module._free(obj.ptr);

        if (ret.result !== 0) {
            throw new Error('Classification failed (err code: ' + ret.result + ')');
        }


        let jsResult = {
            anomaly: ret.anomaly,
            results: []
        };

        for (let cx = 0; cx < ret.size(); cx++) {
            let c = ret.get(cx);
            if (props.model_type === 'object_detection' || props.model_type === 'constrained_object_detection') {
                jsResult.results.push({ label: c.label, value: c.value, x: c.x, y: c.y, width: c.width, height: c.height });
            }
            else {
                jsResult.results.push({ label: c.label, value: c.value });
            }
            c.delete();
        }

        ret.delete();

        return jsResult;
    }

    classifyContinuous(rawData, enablePerfCal = true) {
        if (!classifierInitialized) throw new Error('Module is not initialized');

        let props = Module.get_properties();

        const obj = this._arrayToHeap(rawData);
        let ret = Module.run_classifier_continuous(obj.buffer.byteOffset, rawData.length, false, enablePerfCal);
        Module._free(obj.ptr);

        if (ret.result !== 0) {
            throw new Error('Classification failed (err code: ' + ret.result + ')');
        }


        let jsResult = {
            anomaly: ret.anomaly,
            results: []
        };

        for (let cx = 0; cx < ret.size(); cx++) {
            let c = ret.get(cx);
            if (props.model_type === 'object_detection' || props.model_type === 'constrained_object_detection') {
                jsResult.results.push({ label: c.label, value: c.value, x: c.x, y: c.y, width: c.width, height: c.height });
            }
            else {
                jsResult.results.push({ label: c.label, value: c.value });
            }
            c.delete();
        }

        ret.delete();

        return jsResult;
    }

    getProperties() {
        return Module.get_properties();
    }

    _arrayToHeap(data) {
        let typedArray = new Float32Array(data);
        let numBytes = typedArray.length * typedArray.BYTES_PER_ELEMENT;
        let ptr = Module._malloc(numBytes);
        let heapBytes = new Uint8Array(Module.HEAPU8.buffer, ptr, numBytes);
        heapBytes.set(new Uint8Array(typedArray.buffer));
        return { ptr: ptr, buffer: heapBytes };
    }
}

//END OF TEMPLATE CODE    