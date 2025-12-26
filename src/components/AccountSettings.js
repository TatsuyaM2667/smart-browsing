import React, { useState, useEffect } from 'react';
import { auth } from '../firebase';
import { updatePassword, updateProfile } from 'firebase/auth';

export default function AccountSettings() {
    const user = auth.currentUser;
    const [displayName, setDisplayName] = useState(user?.displayName || '');
    const [newPassword, setNewPassword] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        setMessage('');
        setError('');
        try {
            await updateProfile(user, { displayName });
            setMessage('Profile updated successfully!');
        } catch (err) {
            setError(err.message);
        }
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        setMessage('');
        setError('');
        try {
            await updatePassword(user, newPassword);
            setMessage('Password updated successfully!');
            setNewPassword('');
        } catch (err) {
            setError(err.message);
        }
    };

    if (!user) {
        return (
            <div className="account-settings-container" style={{ padding: '20px', textAlign: 'center' }}>
                <h3>Please sign in to access account settings.</h3>
            </div>
        );
    }

    return (
        <div className="account-settings-container" style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
            <h2 style={{ fontWeight: 300, marginBottom: '30px' }}>Account Settings</h2>

            <section className="settings-section" style={{ marginBottom: '40px', padding: '20px', background: 'var(--bg-secondary)', borderRadius: '12px' }}>
                <h3>Profile Information</h3>
                <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <div className="form-group">
                        <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>Email</label>
                        <input type="text" value={user.email} disabled style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)' }} />
                    </div>
                    <div className="form-group">
                        <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>Display Name</label>
                        <input
                            type="text"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            placeholder="Your Name"
                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                        />
                    </div>
                    <button type="submit" style={{ padding: '10px', borderRadius: '8px', border: 'none', background: 'var(--color-accent)', color: 'white', cursor: 'pointer' }}>Update Profile</button>
                </form>
            </section>

            <section className="settings-section" style={{ marginBottom: '40px', padding: '20px', background: 'var(--bg-secondary)', borderRadius: '12px' }}>
                <h3>Security</h3>
                <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <div className="form-group">
                        <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>New Password</label>
                        <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Enter new password"
                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                        />
                    </div>
                    <button type="submit" style={{ padding: '10px', borderRadius: '8px', border: 'none', background: 'var(--color-accent)', color: 'white', cursor: 'pointer' }}>Change Password</button>
                </form>
            </section>

            <section className="settings-section" style={{ marginBottom: '40px', padding: '20px', background: 'var(--bg-secondary)', borderRadius: '12px' }}>
                <h3>Browser Sync</h3>
                <p style={{ fontSize: '0.9rem', opacity: 0.8 }}>Link your local browser settings (Theme, Wallpaper) to your account.</p>
                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                    <button
                        onClick={() => {
                            const config = {
                                theme: localStorage.getItem('theme'),
                                wallpaper: localStorage.getItem('wallpaper')
                            };
                            // In a real app, save 'config' to Firestore here
                            setMessage('Browser settings synced to account!');
                        }}
                        style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#722ed1', color: 'white', cursor: 'pointer' }}
                    >
                        Sync Now
                    </button>
                </div>
            </section>

            {message && <p style={{ color: '#52c41a', padding: '10px', background: 'rgba(82, 196, 26, 0.1)', borderRadius: '8px' }}>{message}</p>}
            {error && <p style={{ color: '#f5222d', padding: '10px', background: 'rgba(245, 34, 45, 0.1)', borderRadius: '8px' }}>{error}</p>}
        </div>
    );
}
