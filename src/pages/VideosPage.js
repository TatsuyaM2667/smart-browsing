import React, { useState, useEffect } from 'react';
import '../App.css';

const { electronAPI } = window;

export default function VideosPage() {
    const [videos, setVideos] = useState([]);
    const [selectedVideos, setSelectedVideos] = useState([]);

    useEffect(() => {
        document.title = 'Extracted Videos';
        const fetchVideos = async () => {
            const vids = await electronAPI.getExtractedVideos();
            setVideos(vids || []);
        };
        fetchVideos();
    }, []);

    const toggleSelect = (url) => {
        if (selectedVideos.includes(url)) {
            setSelectedVideos(selectedVideos.filter(u => u !== url));
        } else {
            setSelectedVideos([...selectedVideos, url]);
        }
    };

    const handleDownloadSelected = () => {
        selectedVideos.forEach(url => {
            electronAPI.downloadVideo(url);
        });
        alert(`Started downloading ${selectedVideos.length} videos.`);
        setSelectedVideos([]);
    };

    const handleDownloadAll = () => {
        videos.forEach(url => {
            electronAPI.downloadVideo(url);
        });
        alert(`Started downloading all ${videos.length} videos.`);
    };

    return (
        <div className="images-page"> {/* Reuse images-page style for consistency */}
            <header className="images-header">
                <h1>Extracted Videos ({videos.length})</h1>
                <div className="images-actions">
                    <button onClick={handleDownloadSelected} disabled={selectedVideos.length === 0}>
                        Download Selected ({selectedVideos.length})
                    </button>
                    <button onClick={handleDownloadAll} disabled={videos.length === 0}>
                        Download All
                    </button>
                </div>
            </header>
            <div className="images-grid">
                {videos.map((url, index) => (
                    <div
                        key={index}
                        className={`image-card ${selectedVideos.includes(url) ? 'selected' : ''}`}
                        onClick={() => toggleSelect(url)}
                        style={{ background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
                    >
                        <video
                            src={url}
                            style={{ maxWidth: '100%', maxHeight: '100%' }}
                            muted
                            onMouseOver={e => {
                                const playPromise = e.target.play();
                                if (playPromise !== undefined) {
                                    playPromise.catch(error => {
                                        console.error("Video play failed:", error);
                                    });
                                }
                            }}
                            onMouseOut={e => {
                                e.target.pause();
                                try { e.target.currentTime = 0; } catch (err) { }
                            }}
                            onError={(e) => {
                                e.target.style.display = 'none';
                                const placeholder = document.createElement('div');
                                placeholder.className = 'video-placeholder';
                                placeholder.innerText = 'Preview Unavailable';
                                placeholder.style.color = '#888';
                                placeholder.style.fontSize = '12px';
                                e.target.parentElement.appendChild(placeholder);
                            }}
                        />
                        <div className="image-overlay">
                            {selectedVideos.includes(url) && <span className="checkmark">✔</span>}
                            <div className="video-url-hint" style={{ position: 'absolute', bottom: '5px', left: '5px', right: '5px', fontSize: '10px', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', background: 'rgba(0,0,0,0.5)', padding: '2px' }}>
                                {url}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            {videos.length === 0 && (
                <div style={{ textAlign: 'center', marginTop: '50px', color: '#888' }}>
                    No videos detected on the source page.
                </div>
            )}
        </div>
    );
}
