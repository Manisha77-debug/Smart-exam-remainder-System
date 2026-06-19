require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
// Set a higher limit to accommodate base64 image strings
app.use(express.json({ limit: '10mb' }));

app.post('/ocr', async (req, res) => {
    try {
        const { image } = req.body;

        if (!image) {
            return res.status(400).json({ error: 'No image provided' });
        }

        // OCR.space requires the data URI prefix (e.g., data:image/png;base64,) 
        // when using the base64Image parameter.
        let base64Image = image;
        if (!image.startsWith('data:image')) {
            base64Image = `data:image/jpeg;base64,${image}`;
        }

        // Prepare parameters for OCR.space API
        const params = new URLSearchParams();
        params.append('base64Image', base64Image);
        params.append('apikey', 'helloworld'); 
        params.append('isTable', 'true');
        params.append('OCREngine', '2');

        // Call OCR.space API
        const response = await fetch('https://api.ocr.space/parse/image', {
            method: 'POST',
            body: params
        });

        const data = await response.json();
        
        // Log raw OCR response for debugging
        console.log('Raw OCR Response:', JSON.stringify(data, null, 2));

        if (data.IsErroredOnProcessing) {
            console.error('OCR.space Error:', data.ErrorMessage);
            return res.status(500).json({
                error: 'Failed to process image via OCR.space',
                details: data.ErrorMessage
            });
        }

        // Extract text from the response
        let text = '';
        if (data.ParsedResults && data.ParsedResults.length > 0) {
            text = data.ParsedResults[0].ParsedText || '';
        }

        res.json({ text });

    } catch (error) {
        console.error('Server error during OCR processing:', error);
        res.status(500).json({ error: 'Internal server error processing OCR request' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
