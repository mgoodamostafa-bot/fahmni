import React, { useEffect, useState } from 'react';
import { NotificationCenter } from './NotificationCenter';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, User, LogOut, Menu, X, FileText } from 'lucide-react';
import { getTenantAuth, getTenantDb } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { useTenant } from '../contexts/TenantContext';

export const Navbar: React.FC = () => {
  const [isOpen, setIsOpen] = React.useState(false);
  const { settings: siteSettings } = useSettings();
  const { tenantData } = useTenant();
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const handleLogout = async () => {
    await signOut(getTenantAuth());
    navigate('/login');
  };

  return (
    <nav className="bg-brand-dark/80 backdrop-blur-md sticky top-0 z-50 border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Left Side: Actions (Profile, Notifications, Menu) - Moved to left by being second in RTL order */}
          <div className="flex items-center gap-2 sm:gap-6">
            <div className="hidden md:flex items-center space-x-6 space-x-reverse ml-4">
              <Link
                to="/"
                className="text-gray-300 hover:text-white px-2 py-2 rounded-md text-base lg:text-lg font-medium transition-colors whitespace-nowrap"
              >
                الرئيسية
              </Link>
              <Link
                to="/courses"
                className="text-gray-300 hover:text-white px-2 py-2 rounded-md text-base lg:text-lg font-medium transition-colors whitespace-nowrap"
              >
                الكورسات
              </Link>
              {user && (
                <Link
                  to={
                    profile?.role === 'admin'
                      ? '/admin'
                      : profile?.role === 'teacher'
                        ? '/teacher'
                        : '/dashboard'
                  }
                  className="text-gray-300 hover:text-white px-2 py-2 rounded-md text-base lg:text-lg font-medium transition-colors whitespace-nowrap"
                >
                  لوحتي
                </Link>
              )}
              {user && profile?.role === 'student' && (
                <Link
                  to="/library"
                  className="text-gray-300 hover:text-white px-2 py-2 rounded-md text-base lg:text-lg font-medium transition-colors whitespace-nowrap"
                >
                  حقيبتي
                </Link>
              )}
            </div>

            <div className="flex items-center gap-2 sm:gap-4">
              {user && <NotificationCenter />}

              {user ? (
                <div className="flex items-center gap-3 sm:gap-6">
                  <Link
                    to="/profile"
                    className="flex items-center gap-2 sm:gap-3 group max-w-[150px] sm:max-w-none"
                  >
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-brand-blue/10 overflow-hidden flex items-center justify-center border border-white/10 group-hover:border-brand-blue transition-colors shrink-0">
                      {profile?.imageUrl ? (
                        <img src={profile.imageUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <User size={18} className="text-brand-blue" />
                      )}
                    </div>
                    <div className="hidden sm:block text-right overflow-hidden">
                      <p className="text-xs font-black text-white truncate max-w-[80px] lg:max-w-[120px]">
                        {profile?.displayName || user.email}
                      </p>
                      <p className="text-[9px] text-brand-blue font-bold uppercase tracking-widest">
                        {profile?.role === 'admin'
                          ? 'مدير'
                          : profile?.role === 'teacher'
                            ? 'مدرس'
                            : 'طالب'}
                      </p>
                    </div>
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="lg:flex items-center gap-2 text-red-100/40 hover:text-red-400 px-2 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
                  >
                    <LogOut size={16} /> <span className="hidden sm:inline">خروج</span>
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 sm:gap-4">
                  <Link
                    to="/login"
                    className="text-gray-300 hover:text-white px-2 py-2 text-xs sm:text-sm font-black uppercase tracking-widest transition-colors hidden xs:block"
                  >
                    دخول
                  </Link>
                  <Link
                    to="/register"
                    className="btn-secondary !px-3 !py-1.5 !text-[10px] sm:!px-6 sm:!py-2.5 sm:!text-xs whitespace-nowrap"
                  >
                    اشترك
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Right Side: Branding (Logo & Site Name) - Moved to right by being first in RTL order */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center gap-3">
              {tenantData?.logo ? (
                <div className="h-11 w-11 sm:h-13 sm:w-13 shrink-0 flex items-center justify-center overflow-hidden">
                  <img
                    src={tenantData.logo}
                    alt={tenantData?.name}
                    className="w-full h-full object-cover rounded-full"
                  />
                </div>
              ) : siteSettings.logoUrl ? (
                <div className="h-11 w-11 sm:h-13 sm:w-13 shrink-0 flex items-center justify-center overflow-hidden">
                  <img
                    src={siteSettings.logoUrl}
                    alt={siteSettings.siteName}
                    className="w-full h-full object-cover rounded-full"
                  />
                </div>
              ) : (
                <div className="bg-brand-blue p-2.5 rounded-xl shadow-lg shadow-brand-500/20">
                  <BookOpen className="w-6 h-6 text-white" />
                </div>
              )}
              <span className="text-2xl font-black tracking-tight text-white font-display">
                {tenantData?.name || siteSettings.siteName || 'فهمني'}
              </span>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
};
