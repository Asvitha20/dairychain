import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Droplet, ShieldCheck, Globe, Menu, X, Activity, LogOut, Users, Wallet } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useWallet } from '../hooks/useWallet';
import { ROLES, ROUTE_ACCESS } from '../config/roleAccess';

const NAV_LINKS = [
  { path: '/', label: 'Home', end: true, public: true },
  { path: '/dashboard', label: 'Dashboard' },
  { path: '/batches', label: 'Batches' },
  { path: '/violations', label: 'Violations' },
  { path: '/verify', label: 'Verify' },
  { path: '/scan', label: 'Scan' },
  { path: '/ledger', label: 'Ledger' },
  { path: '/about', label: 'About' },
  { path: '/users', label: 'Users', icon: Users, adminOnly: true },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();
  const { address, isConnecting, error: walletError, connectWallet } = useWallet();
  const onLanding = pathname === '/';
  const navText = onLanding ? 'text-white/80 hover:text-white hover:bg-white/10' : 'text-slate-500 hover:text-[#164d33] hover:bg-[#f3f8f4]';
  const activeNav = onLanding ? 'text-white bg-white/15' : 'text-[#164d33] bg-[#eaf6ed]';

  const userRole = user?.role;
  const visibleLinks = NAV_LINKS.filter((link) => {
    if (link.adminOnly && userRole !== 'admin') return false;
    if (link.public) return true;
    if (!isAuthenticated || !userRole) return false;
    const allowed = ROUTE_ACCESS[link.path] || [];
    return allowed.includes(userRole) || userRole === 'admin';
  });

  const roleMeta = userRole ? ROLES[userRole] : null;

  const handleLogout = () => {
    logout();
    setMobileOpen(false);
    navigate('/login');
  };

  const shortAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : null;

  return (
    <header className={`fixed top-0 inset-x-0 z-50 h-[72px] transition-all duration-300 ${onLanding ? 'border-b border-white/15 bg-[#123b2a]/10' : 'glass-nav border-b border-emerald-900/10 shadow-[0_4px_24px_rgba(27,67,48,.05)]'}`}>
      <div className="mx-auto h-full max-w-7xl px-4 md:px-8 flex items-center justify-between">
        <NavLink to="/" className="flex items-center gap-2.5 shrink-0 group">
          <span className={`relative flex items-center justify-center w-9 h-9 rounded-xl shadow-lg transition-transform group-hover:rotate-[-5deg] ${onLanding ? 'bg-white/15 border border-white/30' : 'bg-[#164d33] shadow-emerald-900/15'}`}><Droplet className={`w-[18px] h-[18px] ${onLanding ? 'text-white' : 'text-white'}`} strokeWidth={2.5} /><ShieldCheck className={`w-3.5 h-3.5 absolute -bottom-1 -right-1 ${onLanding ? 'text-[#f6e1ae]' : 'text-[#a8e6bb]'}`} /></span>
          <span className={`font-semibold text-[17px] tracking-tight ${onLanding ? 'text-white' : 'text-[#164d33]'}`}>Dairy<span className={onLanding ? 'text-[#f6e1ae]' : 'text-[#2d8b57]'}>Chain</span></span>
        </NavLink>

        <nav className="hidden md:flex items-center gap-1">{visibleLinks.map((link) => <NavLink key={link.path} to={link.path} end={link.end} className={({ isActive }) => `relative px-3.5 py-2 text-[13px] font-semibold rounded-lg inline-flex items-center gap-1.5 ${isActive ? activeNav : navText}`}>{link.icon && <link.icon className="w-3.5 h-3.5" />}{link.label}</NavLink>)}</nav>

        <div className="hidden md:flex items-center gap-3">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${onLanding ? 'bg-white/10 border-white/25 text-white/85' : 'bg-[#eff9f1] border-[#cbe8d1] text-[#267447]'}`}><Activity className="w-3 h-3" /> Network live</span>

          <button
            type="button"
            onClick={connectWallet}
            disabled={isConnecting}
            title={walletError || 'Connect MetaMask wallet'}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold transition-colors disabled:cursor-wait disabled:opacity-70 ${onLanding ? 'border-white/25 bg-white/10 text-white hover:bg-white/20' : 'border-[#cbe8d1] bg-[#eff9f1] text-[#267447] hover:bg-[#e5f5e9]'}`}
          >
            <Wallet className="h-3 w-3" />
            {isConnecting ? 'Connecting...' : address ? shortAddress : 'Connect Wallet'}
          </button>

          <button type="button" aria-label="Network settings" className={`p-2 rounded-lg ${onLanding ? 'text-white/70 hover:text-white hover:bg-white/10' : 'text-slate-400 hover:text-[#164d33] hover:bg-[#eff9f1]'}`}><Globe className="w-4 h-4" /></button>

          {isAuthenticated && roleMeta && (
            <div className="flex items-center gap-2.5">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-[10px] font-bold tracking-wider ${
                onLanding
                  ? 'bg-white/10 border-white/25 text-white/85'
                  : userRole === 'admin'
                    ? 'bg-navy/10 border-navy/20 text-navy'
                    : userRole === 'transport'
                      ? 'bg-amber/10 border-amber/20 text-amber'
                      : 'bg-mint/10 border-mint/20 text-mint'
              }`}>
                {roleMeta.icon} {roleMeta.label}
              </span>

              <div className="hidden lg:flex flex-col items-end leading-none">
                <span className={`text-[12px] font-semibold ${onLanding ? 'text-white' : 'text-ink-primary'}`}>
                  {user?.name}
                </span>
                <span className={`text-[10px] ${onLanding ? 'text-white/55' : 'text-ink-muted'}`}>
                  {user?.email}
                </span>
              </div>

              <span className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                onLanding
                  ? 'bg-white/15 border border-white/30 text-white'
                  : 'bg-navy text-white shadow-sm'
              }`}>
                {user?.initials || 'DC'}
              </span>

              <button
                type="button"
                onClick={handleLogout}
                title="Sign out"
                className={`p-2 rounded-lg transition-colors ${onLanding ? 'text-white/70 hover:text-white hover:bg-white/10' : 'text-slate-400 hover:text-danger hover:bg-danger/5'}`}
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        <button type="button" className={`md:hidden p-2 ${onLanding ? 'text-white' : 'text-[#164d33]'}`} aria-label="Toggle menu" onClick={() => setMobileOpen((open) => !open)}>{mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}</button>
      </div>
      {mobileOpen && <div className="md:hidden absolute inset-x-0 top-[72px] bg-white border-b border-border shadow-xl px-4 py-4 space-y-1">
        {visibleLinks.map((link) => <NavLink key={link.path} to={link.path} end={link.end} onClick={() => setMobileOpen(false)} className={({ isActive }) => `flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold ${isActive ? 'text-[#164d33] bg-[#eaf6ed]' : 'text-slate-500'}`}>{link.icon && <link.icon className="w-4 h-4" />}{link.label}</NavLink>)}
        {isAuthenticated && (
          <div className="flex items-center justify-between pt-2 border-t border-border mt-2">
            <span className="text-xs font-semibold text-ink-secondary">{roleMeta?.icon} {user?.name}</span>
            <button type="button" onClick={handleLogout} className="text-xs font-semibold text-danger hover:underline">Sign out</button>
          </div>
        )}
      </div>}
    </header>
  );
}
