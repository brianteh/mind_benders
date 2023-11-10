#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include "esp_camera.h"
#include "camera_pin_definition.h"

const char* ssid = "a";
const char* password = "12345678";
const char* serverAddress = "http://192.168.209.38:3000/upload_image";

camera_fb_t * fb = NULL;
size_t imageBufferSize = 0;

//Wifi Configuration
void WIFI_init(const char* wifi_ssid, const char* wifi_password){
  //Connect to Router
  WiFi.begin(wifi_ssid, wifi_password);
  WiFi.setSleep(false);
  
  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.print(".");
  }
  Serial.println();
  Serial.print("Established connection with :");
  Serial.println(wifi_ssid);
  Serial.println();
  Serial.print("Connected to network with IP address: ");
  Serial.println(WiFi.localIP());
}

//Camera configuration
bool initCamera(){
   
  camera_config_t config;
  
   
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.frame_size = FRAMESIZE_UXGA;
  config.pixel_format = PIXFORMAT_JPEG; // for streaming
  //config.pixel_format = PIXFORMAT_RGB565; // for face detection/recognition
  config.grab_mode = CAMERA_GRAB_WHEN_EMPTY;
  config.fb_location = CAMERA_FB_IN_PSRAM;
  config.jpeg_quality = 24;
  config.fb_count = 1;
  
  // if PSRAM IC present, init with UXGA resolution and higher JPEG quality
  //                      for larger pre-allocated frame buffer.
  if(config.pixel_format == PIXFORMAT_JPEG){
    if(psramFound()){
      config.jpeg_quality = 10;
      config.fb_count = 2;
      config.grab_mode = CAMERA_GRAB_LATEST;
    } else {
      // Limit the frame size when PSRAM is not available
      config.frame_size = FRAMESIZE_SVGA;
      config.fb_location = CAMERA_FB_IN_DRAM;
    }
  } else {
    // Best option for face detection/recognition
    config.frame_size = FRAMESIZE_240X240;
#if CONFIG_IDF_TARGET_ESP32S3
    config.fb_count = 2;
#endif
  }

  esp_err_t result = esp_camera_init(&config);
   
  if (result != ESP_OK) {
    return false;
  }
 
  return true;
}

//HTTP POST request to send binary image data to server
void sendImageToServer(uint8_t* imageBuffer, size_t imageSize) {
  HTTPClient http;
  
  http.setTimeout(5000);  
  http.begin(serverAddress);
  const char* contentType = "image/jpeg";
  http.addHeader("Content-Type", contentType);

  int httpResponseCode = http.POST(imageBuffer, imageSize);

  if (httpResponseCode > 0) {
    Serial.printf("HTTP Response code: %d\n", httpResponseCode);
    String response = http.getString();
    //Serial.println(response);
    //the action after receiving the output from server
    dosomething(response);
  } else {
    Serial.printf("HTTP POST request failed, error: %s\n", http.errorToString(httpResponseCode).c_str());
  }

  http.end();
}

//Capture Image
void captureImage() {
    // Capture an image
    fb = esp_camera_fb_get();

    if (!fb) {
        Serial.println("Camera capture failed");
        return;
    }

    // Get the image buffer and its size
    imageBufferSize = fb->len;
    uint8_t* imageBuffer = fb->buf;

    // Send image to server
    sendImageToServer(imageBuffer,imageBufferSize);

    // Free the frame buffer to release memory
    esp_camera_fb_return(fb);
}

void dosomething(String payload){
  DynamicJsonDocument doc(300);
  DeserializationError error = deserializeJson(doc,payload);
  if(error){
    Serial.println("JSON parsing failed:");
    Serial.println(error.c_str());
  }else{
    //CHANGE the code below
    if(doc["status"]==1){
      //do something
      Serial.println("xxx");
    }else if(doc["status"]==0){
      //do something
      Serial.println("sss");
    }
  }
}
void setup() {
  Serial.begin(115200);
  if(initCamera()){
    Serial.println("Camera initialized!");
  }else{
    Serial.println("Camera fail to initialize!");
  }
  WIFI_init(ssid,password);
}

void loop() {
  delay(1000);
  captureImage();
  
}
