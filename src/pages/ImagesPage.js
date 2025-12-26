import React, { useState, useEffect } from 'react';
import '../App.css';

const { electronAPI } = window;

export default function ImagesPage() {
    // We fetch images from main process because we are in a new tab/view
    const [images, setImages] = useState([]);
    const [selectedImages, setSelectedImages] = useState([]);

    useEffect(() => {
        document.title = 'Extracted Images';
        const fetchImages = async () => {
            const imgs = await electronAPI.getExtractedImages();
            setImages(imgs || []);
        };
        fetchImages();
    }, []);

    const toggleSelect = (url) => {
        if (selectedImages.includes(url)) {
            setSelectedImages(selectedImages.filter(u => u !== url));
        } else {
            setSelectedImages([...selectedImages, url]);
        }
    };

    const handleDownloadSelected = () => {
        selectedImages.forEach(url => {
            electronAPI.downloadImage(url);
        });
        alert(`Started downloading ${selectedImages.length} images.`);
        setSelectedImages([]);
    };

    const handleDownloadAll = () => {
        images.forEach(url => {
            electronAPI.downloadImage(url);
        });
        alert(`Started downloading all ${images.length} images.`);
    }

    return (
        <div className="images-page">
            <header className="images-header">
                <h1>Extracted Images ({images.length})</h1>
                <div className="images-actions">
                    <button onClick={handleDownloadSelected} disabled={selectedImages.length === 0}>
                        Download Selected ({selectedImages.length})
                    </button>
                    <button onClick={handleDownloadAll} disabled={images.length === 0}>
                        Download All
                    </button>
                </div>
            </header>
            <div className="images-grid">
                {images.map((url, index) => (
                    <div
                        key={index}
                        className={`image-card ${selectedImages.includes(url) ? 'selected' : ''}`}
                        onClick={() => toggleSelect(url)}
                    >
                        <img src={url} alt={`Extracted ${index}`} loading="lazy" />
                        <div className="image-overlay">
                            {selectedImages.includes(url) && <span className="checkmark">✔</span>}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
