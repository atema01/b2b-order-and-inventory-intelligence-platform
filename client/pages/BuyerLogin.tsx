
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
//security and sanitization for the user input 
import {
  normalizeLoginIdentifier,
  sanitizeLoginIdentifierInput,
  sanitizeLoginPasswordInput,
  validateLoginCredentials,
} from '../utils/loginValidation';

const BuyerLogin: React.FC = () => {
  const { t } = useLanguage();
  const { login } = useAuth();
  const navigate = useNavigate();
  // Local State: Tracks user input, error messages, password visibility, and loading status.
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const validation = validateLoginCredentials(identifier, password);
    setIdentifier(validation.cleanedIdentifier);
    setPassword(validation.cleanedPassword);

    if (!validation.isValid) {
      setError(validation.error || 'Login failed');
      return;
    }

    setIsLoading(true);

    try {
      const result = await login(validation.cleanedIdentifier, validation.cleanedPassword, 'buyer');
      if (result.success) {
        navigate('/');
      } else {
        setError(result.error || 'Login failed');
        setIsLoading(false);
      }
    } catch (err) {
      setError('An unexpected error occurred.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-4">
      <div className="w-full max-w-[400px] flex flex-col items-center">

        {/* Logo/Icon */}
        <div className="bg-[#12B3D8] rounded-[20px] size-[72px] flex items-center justify-center shadow-lg shadow-[#12B3D8]/30 mb-8">
          <span className="material-symbols-outlined text-white text-[32px]">shopping_bag</span>
        </div>

        {/* Headings */}
        <h1 className="text-[28px] font-black text-[#0F172A] tracking-tight mb-3 text-center">
          {t('login.buyerTitle')}
        </h1>
        <p className="text-[#64748B] text-center text-[15px] leading-relaxed mb-10 font-medium max-w-[320px]">
          {t('login.buyerSubtitle')}
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="w-full space-y-5">
          <div className="space-y-2">
            <label className="text-[13px] font-semibold text-[#0F172A] block">{t('login.buyerIdLabel')}</label>
            <div className="relative">
              <input
                type="text"
                required
                className="w-full h-[52px] px-4 rounded-[12px] border border-[#E2E8F0] text-[#0F172A] font-medium placeholder:text-[#94A3B8] focus:border-[#12B3D8] focus:ring-1 focus:ring-[#12B3D8] outline-none transition-all pr-12"
                placeholder="B-0001 or buyer@retailer.com"
                value={identifier}
                onChange={(e) => {
                  setIdentifier(sanitizeLoginIdentifierInput(e.target.value));
                  if (error) setError('');
                }}
                onBlur={() => setIdentifier(normalizeLoginIdentifier(identifier))}
              />
              <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-[#64748B] pointer-events-none text-[20px]">
                badge
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[13px] font-semibold text-[#0F172A] block">{t('login.password')}</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                className="w-full h-[52px] px-4 rounded-[12px] border border-[#E2E8F0] text-[#0F172A] font-medium placeholder:text-[#94A3B8] focus:border-[#12B3D8] focus:ring-1 focus:ring-[#12B3D8] outline-none transition-all tracking-widest pr-12"
                placeholder="•••••••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(sanitizeLoginPasswordInput(e.target.value));
                  if (error) setError('');
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#0F172A] transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">
                  {showPassword ? 'visibility' : 'visibility_off'}
                </span>
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 rounded-[12px] border border-red-100 flex items-center gap-2 text-red-600 text-xs font-bold">
              <span className="material-symbols-outlined text-sm">error</span>
              {error}
            </div>
          )}

          <div className="flex justify-end pt-1">
            <button type="button" className="text-[13px] font-bold text-[#12B3D8] hover:opacity-80 transition-opacity">
              {t('login.forgot')}
            </button>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-[56px] bg-[#12B3D8] hover:bg-[#0EA2C2] active:scale-[0.98] transition-all rounded-[12px] text-white font-bold text-[16px] shadow-lg shadow-[#12B3D8]/20 flex items-center justify-center gap-2 mt-4 disabled:opacity-70"
          >
            {isLoading ? t('login.authenticating') : t('login.signIn')}
          </button>
        </form>

        {/* Footer Box */}
        <div className="w-full mt-12 bg-[#EAF6F9] border border-[#E0F2F6] rounded-[20px] p-6 text-center">
          <p className="text-[14px] font-medium text-[#0F172A] mb-3">{t('login.trouble')}</p>
          <div className="flex items-center justify-center gap-4 text-[14px] font-bold text-[#12B3D8]">
            <a href="#" className="flex items-center gap-1 hover:opacity-80">
              <span className="material-symbols-outlined text-[18px]">help</span>
              {t('login.faq')}
            </a>
            <div className="w-[1px] h-4 bg-[#BCE3EB]"></div>
            <a href="#" className="flex items-center gap-1 hover:opacity-80">
              <span className="material-symbols-outlined text-[18px]">headset_mic</span>
              {t('login.support')}
            </a>
          </div>
        </div>

        <div className="mt-8">
          <Link to="/login" className="text-[#94A3B8] text-[13px] font-medium hover:text-[#0F172A] transition-colors flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            {t('login.switch')}
          </Link>
        </div>

        <p className="mt-8 text-[#CBD5E1] text-[11px] font-medium">v4.2.0 • B2B Retail Intelligence</p>
      </div>
    </div>
  );
};

export default BuyerLogin;
