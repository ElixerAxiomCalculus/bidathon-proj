import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getProfile,
  updateProfile,
  changePassword,
  deleteAccount,
  logout,
} from '../services/api';
import './ProfileSettings.css';

const TABS = ['Profile', 'Security', 'Danger Zone'];

const ProfileSettings = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);
  const [profile, setProfile] = useState(null);
  const [flash, setFlash] = useState({ type: '', msg: '' });
  const [loading, setLoading] = useState(false);

  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');

  const [deleteConfirm, setDeleteConfirm] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const data = await getProfile();
      setProfile(data);
      setEditName(data.name || '');
      setEditPhone(data.phone || '');
    } catch {
      setFlash({ type: 'error', msg: 'Failed to load profile' });
    }
  };

  const showFlash = (type, msg) => {
    setFlash({ type, msg });
    setTimeout(() => setFlash({ type: '', msg: '' }), 4000);
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const updated = await updateProfile({ name: editName, phone: editPhone });
      setProfile((p) => ({ ...p, ...updated }));
      showFlash('success', 'Profile updated');
    } catch (err) {
      showFlash('error', err.message || 'Update failed');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPw !== confirmPw) {
      showFlash('error', 'New passwords do not match');
      return;
    }
    if (newPw.length < 6) {
      showFlash('error', 'Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      await changePassword(currentPw, newPw);
      showFlash('success', 'Password changed successfully');
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
    } catch (err) {
      showFlash('error', err.message || 'Password change failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== 'DELETE') return;
    setLoading(true);
    try {
      await deleteAccount();
      logout();
      navigate('/');
    } catch (err) {
      showFlash('error', err.message || 'Deletion failed');
      setLoading(false);
    }
  };

  return (
    <div className="profile-page">
      <div className="profile-topbar">
        <button
          className="profile-topbar__back"
          onClick={() => navigate('/dashboard')}
        >
          &larr; Dashboard
        </button>
        <h1 className="profile-topbar__title">Settings</h1>
        <div style={{ width: 80 }} />
      </div>

      {flash.msg && (
        <div className={`profile-flash profile-flash--${flash.type}`}>
          {flash.msg}
        </div>
      )}

      <div className="profile-tabs">
        {TABS.map((t, i) => (
          <button
            key={t}
            className={`profile-tab${i === tab ? ' profile-tab--active' : ''}`}
            onClick={() => setTab(i)}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 0 && (
        <div className="profile-card">
          <h2 className="profile-card__section-title">Personal Information</h2>
          <form onSubmit={handleUpdateProfile}>
            <div className="profile-field">
              <label className="profile-label">Full Name</label>
              <input
                className="profile-input"
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="profile-field">
              <label className="profile-label">Email</label>
              <input
                className="profile-input profile-input--readonly"
                type="email"
                value={profile?.email || ''}
                readOnly
              />
            </div>
            <div className="profile-field">
              <label className="profile-label">Phone</label>
              <input
                className="profile-input"
                type="tel"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
              />
            </div>

            {profile && (
              <>
                <h2 className="profile-card__section-title" style={{ marginTop: '1.5rem' }}>
                  Account Stats
                </h2>
                <div className="profile-stat">
                  <span className="profile-stat__label">Conversations</span>
                  <span className="profile-stat__value">{profile.conversation_count ?? 0}</span>
                </div>
                <div className="profile-stat">
                  <span className="profile-stat__label">Watchlist Items</span>
                  <span className="profile-stat__value">{profile.watchlist_count ?? 0}</span>
                </div>
                <div className="profile-stat">
                  <span className="profile-stat__label">Member Since</span>
                  <span className="profile-stat__value">
                    {profile.created_at
                      ? new Date(profile.created_at).toLocaleDateString()
                      : '—'}
                  </span>
                </div>
              </>
            )}

            <button className="profile-btn profile-btn--primary" type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </div>
      )}

      {tab === 1 && (
        <div className="profile-card">
          <h2 className="profile-card__section-title">Change Password</h2>
          <form onSubmit={handleChangePassword}>
            <div className="profile-field">
              <label className="profile-label">Current Password</label>
              <input
                className="profile-input"
                type="password"
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                required
              />
            </div>
            <div className="profile-field">
              <label className="profile-label">New Password</label>
              <input
                className="profile-input"
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <div className="profile-field">
              <label className="profile-label">Confirm New Password</label>
              <input
                className="profile-input"
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                required
              />
            </div>
            <button className="profile-btn profile-btn--primary" type="submit" disabled={loading}>
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>
      )}

      {tab === 2 && (
        <div className="profile-card">
          <h2 className="profile-card__section-title" style={{ color: '#fca5a5' }}>
            Delete Account
          </h2>
          <p className="profile-danger__text">
            This action is permanent and cannot be undone. All your conversations,
            watchlist, and profile data will be permanently deleted.
          </p>
          <div className="profile-danger__confirm">
            <div className="profile-field">
              <label className="profile-label">
                Type DELETE to confirm
              </label>
              <input
                className="profile-input"
                type="text"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder="DELETE"
              />
            </div>
            <button
              className="profile-btn profile-btn--danger"
              onClick={handleDeleteAccount}
              disabled={deleteConfirm !== 'DELETE' || loading}
            >
              {loading ? 'Deleting...' : 'Permanently Delete Account'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileSettings;
