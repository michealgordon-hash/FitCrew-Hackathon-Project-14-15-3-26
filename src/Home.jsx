import React, { useState, useEffect, useRef } from 'react';

export default function Home() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true })
      .then((mediaStream) => {
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      })
      .catch((err) => console.error('Error accessing camera:', err));
  }, []);

  const capturePicture = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      ctx.drawImage(videoRef.current, 0, 0);
      const imageDataUrl = canvas.toDataURL('image/png');
      setCapturedImage(imageDataUrl);
    }
  };

  return (
    <div style={{ textAlign: 'center', padding: '20px' }}>
      <h1>JamFoods</h1>
      <p>Welcome to JamFoods! Use your camera to capture food items.</p>
      <div style={{ margin: '20px auto', width: '640px', height: '480px', border: '1px solid black' }}>
        <video ref={videoRef} autoPlay playsInline style={{ width: '100%', height: '100%' }}></video>
      </div>
      <button onClick={capturePicture} style={{ padding: '10px 20px', fontSize: '16px' }}>Capture Picture</button>
      {capturedImage && (
        <div style={{ marginTop: '20px' }}>
          <h2>Captured Image:</h2>
          <img src={capturedImage} alt="Captured" style={{ maxWidth: '640px', border: '1px solid black' }} />
        </div>
      )}
      <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
    </div>
  );
}