import React, { useState, useEffect, useRef } from 'react';
import { useAuth, UserProfile } from '../../context/AuthContext.tsx';
import { usePreferences } from '../../context/PreferencesContext.tsx';
import { apiRequest } from '../../utils/api.ts';
import {
  User,
  Mail,
  Lock,
  Camera,
  Save,
  CheckCircle2,
  XCircle,
  Sun,
  Moon,
  Languages,
  Trash2,
  Eye,
  EyeOff,
  AtSign,
  ShieldCheck,
} from 'lucide-react';

const PRESET_AVATARS = [
  'https://api.dicebear.com/9.x/shapes/svg?seed=xmonitor-cyan&backgroundColor=0891b2',
  'https://api.dicebear.com/9.x/shapes/svg?seed=xmonitor-emerald&backgroundColor=059669',
  'https://api.dicebear.com/9.x/shapes/svg?seed=xmonitor-indigo&backgroundColor=4f46e5',
  'https://api.dicebear.com/9.x/shapes/svg?seed=xmonitor-rose&backgroundColor=e11d48',
  'https://api.dicebear.com/9.x/shapes/svg?seed=xmonitor-amber&backgroundColor=d97706',
  'https://api.dicebear.com/9.x/bottts-neutral/svg?seed=radar-alpha',
];

export const ProfileView: React.FC = () => {
  const { user, updateUserState } = useAuth();
  const { lang, setLang, theme, setTheme, t } = usePreferences();

  const [displayName, setDisplayName] = useState(user?.displayName || 'Admin User');
  const [username, setUsername] = useState(user?.username || 'admin');
  const [email, setEmail] = useState(user?.email || 'admin@xmonitor.io');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
  const [hasCustomPassword, setHasCustomPassword] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);

  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [profileStatus, setProfileStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [passwordStatus, setPasswordStatus] = useState<{ ok: boolean; message: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const data = await apiRequest<{ user: UserProfile; hasCustomPassword: boolean }>('/api/auth/profile');
        if (data.user) {
          setDisplayName(data.user.displayName);
          setUsername(data.user.username);
          setEmail(data.user.email);
          setAvatarUrl(data.user.avatarUrl || '');
          setHasCustomPassword(Boolean(data.hasCustomPassword));
          updateUserState(data.user);
        }
      } catch {}
    };
    loadProfile();
  }, []);

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setProfileStatus({
        ok: false,
        message: t('Please select a valid image file (PNG, JPG, WEBP, GIF).', 'لطفاً یک فایل تصویری معتبر انتخاب کنید.'),
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 256;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.88);
          setAvatarUrl(compressedDataUrl);
        } else {
          setAvatarUrl(reader.result as string);
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileStatus(null);
    setIsSavingProfile(true);
    try {
      const res = await apiRequest<{ ok: boolean; user: UserProfile }>('/api/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({
          displayName: displayName.trim(),
          username: username.trim(),
          email: email.trim(),
          avatarUrl: avatarUrl.trim(),
        }),
      });
      if (res.ok && res.user) {
        updateUserState(res.user);
        setProfileStatus({
          ok: true,
          message: t('Profile information and avatar saved successfully.', 'اطلاعات پروفایل و آواتار با موفقیت ذخیره شد.'),
        });
      }
    } catch (err: any) {
      setProfileStatus({
        ok: false,
        message: err.message || t('Failed to update profile.', 'خطا در بروزرسانی پروفایل.'),
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordStatus(null);

    if (newPassword.length < 6) {
      setPasswordStatus({
        ok: false,
        message: t('New password must be at least 6 characters.', 'رمز عبور جدید باید حداقل ۶ کاراکتر باشد.'),
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordStatus({
        ok: false,
        message: t('New password and confirmation do not match.', 'رمز عبور جدید و تکرار آن مطابقت ندارند.'),
      });
      return;
    }

    setIsSavingPassword(true);
    try {
      await apiRequest('/api/auth/password', {
        method: 'PUT',
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setHasCustomPassword(true);
      setPasswordStatus({
        ok: true,
        message: t('Password changed successfully.', 'رمز عبور با موفقیت تغییر یافت.'),
      });
    } catch (err: any) {
      setPasswordStatus({
        ok: false,
        message: err.message || t('Failed to change password.', 'خطا در تغییر رمز عبور.'),
      });
    } finally {
      setIsSavingPassword(false);
    }
  };

  const initials = (displayName || username || 'A')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Page Header */}
      <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <User className="w-5 h-5 text-cyan-400" />
            <span>{t('Profile & Account Settings', 'تنظیمات پروفایل و حساب کاربری')}</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {t(
              'Manage your display name, username, email, avatar, security password, and UI preferences',
              'مدیریت نام نمایشی، نام کاربری، ایمیل، تصویر پروفایل، رمز عبور و ظاهر پنل'
            )}
          </p>
        </div>
      </div>

      {/* 1. Interface Preferences (Language & Theme) */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2 border-b border-slate-800 pb-3">
          <Languages className="w-4 h-4 text-cyan-400" />
          <span>{t('Interface Language & Appearance', 'زبان رابط کاربری و حالت نمایش')}</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Language Selection */}
          <div className="bg-slate-950/70 border border-slate-800 p-4 rounded-xl space-y-2.5">
            <div className="font-bold text-slate-200 flex items-center justify-between">
              <span>{t('Panel Language', 'زبان پنل')}</span>
              <span className="text-[11px] text-slate-400 font-normal">
                {lang === 'en' ? 'English (LTR)' : 'فارسی (RTL)'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`px-3 py-2.5 rounded-xl border font-bold flex items-center justify-center gap-2 transition-all ${
                  lang === 'en'
                    ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-400 ring-1 ring-cyan-500/30'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>English (Default)</span>
              </button>
              <button
                type="button"
                onClick={() => setLang('fa')}
                className={`px-3 py-2.5 rounded-xl border font-bold flex items-center justify-center gap-2 transition-all ${
                  lang === 'fa'
                    ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-400 ring-1 ring-cyan-500/30'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>فارسی (Persian)</span>
              </button>
            </div>
          </div>

          {/* Theme Selection */}
          <div className="bg-slate-950/70 border border-slate-800 p-4 rounded-xl space-y-2.5">
            <div className="font-bold text-slate-200 flex items-center justify-between">
              <span>{t('Color Theme', 'پوسته ظاهری')}</span>
              <span className="text-[11px] text-slate-400 font-normal">
                {theme === 'dark' ? t('Dark Mode', 'حالت تیره') : t('Light Mode', 'حالت روشن')}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`px-3 py-2.5 rounded-xl border font-bold flex items-center justify-center gap-2 transition-all ${
                  theme === 'dark'
                    ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-400 ring-1 ring-cyan-500/30'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Moon className="w-4 h-4" />
                <span>{t('Dark Mode', 'حالت دارک')}</span>
              </button>
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`px-3 py-2.5 rounded-xl border font-bold flex items-center justify-center gap-2 transition-all ${
                  theme === 'light'
                    ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-400 ring-1 ring-cyan-500/30'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sun className="w-4 h-4" />
                <span>{t('Light Mode', 'حالت لایت')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Personal Information & Avatar Form */}
      <form onSubmit={handleSaveProfile} className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Camera className="w-4 h-4 text-cyan-400" />
            <span>{t('Personal Profile & Avatar', 'اطلاعات فردی و آواتار')}</span>
          </h3>
        </div>

        {profileStatus && (
          <div
            className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-3 ${
              profileStatus.ok
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {profileStatus.ok ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              <span>{profileStatus.message}</span>
            </div>
            <button type="button" onClick={() => setProfileStatus(null)} className="text-slate-400 hover:text-slate-100">
              {t('Dismiss', 'بستن')}
            </button>
          </div>
        )}

        {/* Avatar Picker Row */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 bg-slate-950/60 border border-slate-800 p-4 rounded-2xl">
          <div className="relative group shrink-0">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-500 border-2 border-slate-700 overflow-hidden flex items-center justify-center text-xl font-bold text-white shadow-lg">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="w-full h-full object-cover"
                  onError={() => setAvatarUrl('')}
                />
              ) : (
                <span>{initials}</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute -bottom-1.5 -right-1.5 p-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-md transition-colors"
              title={t('Upload Avatar', 'آپلود آواتار')}
            >
              <Camera className="w-3.5 h-3.5" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarFileChange}
              className="hidden"
            />
          </div>

          <div className="flex-1 space-y-3 w-full text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium flex items-center gap-1.5 transition-colors"
              >
                <Camera className="w-3.5 h-3.5 text-cyan-400" />
                <span>{t('Upload Photo', 'آپلود تصویر از سیستم')}</span>
              </button>

              {avatarUrl && (
                <button
                  type="button"
                  onClick={() => setAvatarUrl('')}
                  className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 font-medium flex items-center gap-1.5 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{t('Remove Avatar', 'حذف آواتار')}</span>
                </button>
              )}
            </div>

            {/* Preset Avatars */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] text-slate-400">{t('Or pick a preset:', 'یا انتخاب آواتار آماده:')}</span>
              {PRESET_AVATARS.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setAvatarUrl(preset)}
                  className={`w-7 h-7 rounded-lg overflow-hidden border transition-all ${
                    avatarUrl === preset ? 'ring-2 ring-cyan-400 border-cyan-400 scale-105' : 'border-slate-700 opacity-80 hover:opacity-100'
                  }`}
                >
                  <img src={preset} alt={`Preset ${idx + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>

            {/* Direct Avatar URL */}
            <div>
              <input
                type="text"
                value={avatarUrl.startsWith('data:') ? '' : avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder={t('Or paste direct image URL (https://...)', 'یا لینک مستقیم تصویر را وارد کنید (https://...)')}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-slate-200 font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-cyan-500"
                dir="ltr"
              />
            </div>
          </div>
        </div>

        {/* Name, Username, Email Fields */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block text-slate-300 font-medium mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span>{t('Full Name / Display Name', 'نام و نام خانوادگی (نام نمایشی)')}</span>
            </label>
            <input
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={t('e.g. Alex Morgan', 'مثلاً: علی محمدی')}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1.5 flex items-center gap-1.5">
              <AtSign className="w-3.5 h-3.5 text-slate-400" />
              <span>{t('Username (Login ID)', 'نام کاربری (شناسه ورود)')}</span>
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              dir="ltr"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1.5 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-slate-400" />
              <span>{t('Email Address', 'آدرس ایمیل')}</span>
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@xmonitor.io"
              dir="ltr"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSavingProfile}
            className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold shadow-md shadow-cyan-500/20 flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>
              {isSavingProfile
                ? t('Saving Profile...', 'در حال ذخیره پروفایل...')
                : t('Save Profile Changes', 'ذخیره اطلاعات پروفایل')}
            </span>
          </button>
        </div>
      </form>

      {/* 3. Security & Password Change Form */}
      <form onSubmit={handleSavePassword} className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>{t('Change Password & Security', 'تغییر رمز عبور و امنیت حساب')}</span>
          </h3>
          {!hasCustomPassword && (
            <span className="text-[11px] text-slate-400">
              {t('Default initial password:', 'رمز پیش‌فرض اولیه:')}{' '}
              <code className="text-cyan-400 font-mono">admin123456</code>
            </span>
          )}
        </div>

        {passwordStatus && (
          <div
            className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-3 ${
              passwordStatus.ok
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {passwordStatus.ok ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              <span>{passwordStatus.message}</span>
            </div>
            <button type="button" onClick={() => setPasswordStatus(null)} className="text-slate-400 hover:text-slate-100">
              {t('Dismiss', 'بستن')}
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block text-slate-300 font-medium mb-1.5 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              <span>{t('Current Password', 'رمز عبور فعلی')}</span>
            </label>
            <div className="relative">
              <input
                type={showPasswords ? 'text' : 'password'}
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                dir="ltr"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1.5 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-cyan-400" />
              <span>{t('New Password (min 6 chars)', 'رمز عبور جدید (حداقل ۶ کاراکتر)')}</span>
            </label>
            <input
              type={showPasswords ? 'text' : 'password'}
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              dir="ltr"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1.5 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-cyan-400" />
              <span>{t('Confirm New Password', 'تکرار رمز عبور جدید')}</span>
            </label>
            <input
              type={showPasswords ? 'text' : 'password'}
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              dir="ltr"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <button
            type="button"
            onClick={() => setShowPasswords(!showPasswords)}
            className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1.5"
          >
            {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            <span>{showPasswords ? t('Hide Passwords', 'مخفی کردن رمزها') : t('Show Passwords', 'نمایش رمزها')}</span>
          </button>

          <button
            type="submit"
            disabled={isSavingPassword}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <Lock className="w-4 h-4" />
            <span>
              {isSavingPassword
                ? t('Updating Password...', 'در حال تغییر رمز...')
                : t('Update Password', 'ثبت رمز عبور جدید')}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
};
