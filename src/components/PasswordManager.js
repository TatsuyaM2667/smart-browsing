import React, { useState, useEffect } from 'react';

export default function PasswordManager() {
    const [passwords, setPasswords] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showAddForm, setShowAddForm] = useState(false);
    const [newSite, setNewSite] = useState('');
    const [newUsername, setNewUsername] = useState('');
    const [newPassword, setNewPassword] = useState('');

    useEffect(() => {
        const saved = JSON.parse(localStorage.getItem('saved_passwords') || '[]');
        setPasswords(saved);
    }, []);

    const savePasswords = (updated) => {
        setPasswords(updated);
        localStorage.setItem('saved_passwords', JSON.stringify(updated));
    };

    const handleAddPassword = (e) => {
        e.preventDefault();
        const updated = [...passwords, { site: newSite, username: newUsername, password: newPassword, id: Date.now() }];
        savePasswords(updated);
        setNewSite('');
        setNewUsername('');
        setNewPassword('');
        setShowAddForm(false);
    };

    const handleDelete = (id) => {
        if (window.confirm('Delete this password?')) {
            const updated = passwords.filter(p => p.id !== id);
            savePasswords(updated);
        }
    };

    const filtered = passwords.filter(p =>
        p.site.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.username.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="password-manager-container" style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <h2 style={{ fontWeight: 300, margin: 0 }}>Password Manager</h2>
                <button
                    onClick={() => setShowAddForm(!showAddForm)}
                    style={{ padding: '8px 16px', borderRadius: '20px', border: 'none', background: 'var(--color-accent)', color: 'white', cursor: 'pointer' }}
                >
                    {showAddForm ? 'Cancel' : '+ Add Password'}
                </button>
            </div>

            {showAddForm && (
                <div style={{ background: 'var(--bg-secondary)', padding: '20px', borderRadius: '12px', marginBottom: '30px' }}>
                    <h3>Add New Password</h3>
                    <form onSubmit={handleAddPassword} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '10px', alignItems: 'end' }}>
                        <div>
                            <label style={{ fontSize: '0.8rem', display: 'block' }}>Site / URL</label>
                            <input type="text" value={newSite} onChange={e => setNewSite(e.target.value)} required style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }} />
                        </div>
                        <div>
                            <label style={{ fontSize: '0.8rem', display: 'block' }}>Username</label>
                            <input type="text" value={newUsername} onChange={e => setNewUsername(e.target.value)} required style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }} />
                        </div>
                        <div>
                            <label style={{ fontSize: '0.8rem', display: 'block' }}>Password</label>
                            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }} />
                        </div>
                        <button type="submit" style={{ padding: '8px 16px', borderRadius: '4px', border: 'none', background: '#52c41a', color: 'white', cursor: 'pointer' }}>Save</button>
                    </form>
                </div>
            )}

            <div style={{ marginBottom: '20px' }}>
                <input
                    type="text"
                    placeholder="Search passwords..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    style={{ width: '100%', padding: '12px 20px', borderRadius: '25px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none' }}
                />
            </div>

            <div className="password-list">
                {filtered.length === 0 ? (
                    <p style={{ textAlign: 'center', opacity: 0.5 }}>No passwords saved yet.</p>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
                                <th style={{ padding: '12px' }}>Site</th>
                                <th style={{ padding: '12px' }}>Username</th>
                                <th style={{ padding: '12px' }}>Password</th>
                                <th style={{ padding: '12px' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(p => (
                                <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <td style={{ padding: '12px' }}>{p.site}</td>
                                    <td style={{ padding: '12px' }}>{p.username}</td>
                                    <td style={{ padding: '12px' }}>••••••••</td>
                                    <td style={{ padding: '12px' }}>
                                        <button onClick={() => handleDelete(p.id)} style={{ background: 'none', border: 'none', color: '#ff4d4f', cursor: 'pointer' }}>Delete</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
