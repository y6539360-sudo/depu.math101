import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Play,
  Maximize2,
  RotateCcw,
  Heart,
  Search,
  Lock,
  Unlock,
  ShieldAlert,
  Eye,
  EyeOff,
  BookOpen,
  Gamepad2,
  X,
  ExternalLink,
  ChevronRight,
  Calculator
} from 'lucide-react';
import defaultGames from './data/games.json';

// Cryptographic SHA-256 hash of the authorization key (avoids exposing passkey in client code)
const SECURE_PASSKEY_HASH = '8f7644ea26e5f4af133dd45479722a56124a07b3f7abf4d2e692c11d8fdafddc';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return sessionStorage.getItem('math101_auth_token') !== null;
  });
  const [passkeyInput, setPasskeyInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [showPasskey, setShowPasskey] = useState(false);

  // Stealth / Panic disguise mode
  const [isPanicMode, setIsPanicMode] = useState(false);
  const [tabCloaked, setTabCloaked] = useState(false);

  // Games and Filters
  const [games, setGames] = useState(defaultGames);
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGame, setSelectedGame] = useState(null);
  const [isTheaterMode, setIsTheaterMode] = useState(false);
  const [favorites, setFavorites] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('portal_game_favorites') || '[]');
    } catch {
      return [];
    }
  });
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);

  const iframeRef = useRef(null);

  // Fetch games from public/games.json to ensure dynamic sync
  useEffect(() => {
    fetch('/games.json')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setGames(data);
        }
      })
      .catch(() => {
        // Fallback to imported defaultGames is already set
      });
  }, []);

  // Sync favorites to localStorage
  useEffect(() => {
    localStorage.setItem('portal_game_favorites', JSON.stringify(favorites));
  }, [favorites]);

  // Tab cloaking effect
  useEffect(() => {
    if (tabCloaked) {
      document.title = 'Google Docs - Math 101 Lecture Notes';
    } else {
      document.title = isAuthenticated ? 'Math 101 · Interactive Arcade' : 'Math 101 Portal';
    }
  }, [tabCloaked, isAuthenticated]);

  // Global Panic Key listener (Esc key)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isAuthenticated) {
        setIsPanicMode((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAuthenticated]);

  // Passkey verification logic
  // The client code never exposes the passkey string in HTML, JS, or CSS
  const handlePasskeySubmit = async (e) => {
    e.preventDefault();
    if (!passkeyInput.trim()) {
      setAuthError('Please enter the course section passkey.');
      return;
    }

    setIsVerifying(true);
    setAuthError('');

    try {
      // 1. Verify with backend server route
      let serverVerified = false;
      try {
        const response = await fetch('/api/verify-passkey', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ passkey: passkeyInput.trim() }),
        });
        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            serverVerified = true;
          }
        }
      } catch {
        // Server fetch failed, fall through to client cryptographic hash check
      }

      // 2. Cryptographic SHA-256 hash validation
      if (!serverVerified) {
        const encoder = new TextEncoder();
        const data = encoder.encode(passkeyInput.trim());
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

        if (hashHex === SECURE_PASSKEY_HASH) {
          serverVerified = true;
        }
      }

      if (serverVerified) {
        const token = 'auth_' + Date.now();
        sessionStorage.setItem('math101_auth_token', token);
        setIsAuthenticated(true);
        setPasskeyInput('');
        setAuthError('');
      } else {
        setAuthError('Invalid passkey. Access denied.');
      }
    } catch {
      setAuthError('Verification error. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('math101_auth_token');
    setIsAuthenticated(false);
    setSelectedGame(null);
    setIsPanicMode(false);
  };

  const toggleFavorite = (id, e) => {
    if (e) e.stopPropagation();
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const categories = useMemo(() => {
    const set = new Set();
    games.forEach((g) => set.add(g.category));
    return ['All', ...Array.from(set)];
  }, [games]);

  const filteredGames = useMemo(() => {
    return games.filter((g) => {
      const matchesCategory =
        activeCategory === 'All' || g.category.toLowerCase() === activeCategory.toLowerCase();
      const matchesSearch =
        searchQuery === '' ||
        g.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesFavorites = !onlyFavorites || favorites.includes(g.id);

      return matchesCategory && matchesSearch && matchesFavorites;
    });
  }, [games, activeCategory, searchQuery, onlyFavorites, favorites]);

  // Request browser fullscreen for active iframe container
  const handleFullscreen = () => {
    const el = document.getElementById('game-embed-container');
    if (el) {
      if (!document.fullscreenElement) {
        el.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  const handleReloadGame = () => {
    setIframeKey((prev) => prev + 1);
  };

  // Stealth "Panic Screen" Disguise
  if (isPanicMode) {
    return (
      <div className="min-h-screen bg-white text-slate-900 font-serif p-8 md:p-16 max-w-4xl mx-auto leading-relaxed select-text">
        <div className="border-b border-slate-300 pb-4 mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              MATH 101: Calculus & Linear Algebra — Problem Set 4
            </h1>
            <p className="text-sm text-slate-500 font-sans mt-1">
              Department of Mathematics · Spring Term · Instructor: Dr. J. Henderson
            </p>
          </div>
          <button
            onClick={() => setIsPanicMode(false)}
            className="text-xs font-sans px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-slate-300 transition-colors cursor-pointer"
          >
            Resume Portal (Esc)
          </button>
        </div>

        <section className="space-y-6">
          <div className="bg-slate-50 border border-slate-200 p-4 rounded text-sm font-sans text-slate-700">
            <strong>Instructions:</strong> Solve all five problems completely. Show your intermediate eigenvalue computations and characteristic polynomials. Submissions due Friday by 11:59 PM.
          </div>

          <div>
            <h2 className="text-lg font-bold text-slate-800 mb-2">Problem 1. Eigenvalues and Diagonalization</h2>
            <p className="text-slate-700 text-base mb-3">
              Let <span className="italic">A</span> be a 3 &times; 3 real symmetric matrix defined by:
            </p>
            <div className="bg-slate-100 p-3 rounded font-mono text-center text-sm my-3 border border-slate-200">
              A = [ [ 4, -1, 1 ], [ -1, 3, -2 ], [ 1, -2, 3 ] ]
            </div>
            <p className="text-slate-700 text-base">
              (a) Determine the characteristic polynomial <span className="italic">p(&lambda;) = det(A - &lambda;I)</span>.<br />
              (b) Find the orthogonal matrix <span className="italic">P</span> and diagonal matrix <span className="italic">D</span> such that <span className="italic">P<sup>T</sup>AP = D</span>.<br />
              (c) Deduce whether the corresponding quadratic form <span className="italic">Q(x) = x<sup>T</sup>Ax</span> is positive definite.
            </p>
          </div>

          <div className="border-t border-slate-200 pt-6">
            <h2 className="text-lg font-bold text-slate-800 mb-2">Problem 2. Differential Equations & Flow Fields</h2>
            <p className="text-slate-700 text-base mb-3">
              Consider the autonomous non-linear system given by:
            </p>
            <div className="bg-slate-100 p-3 rounded font-mono text-center text-sm my-3 border border-slate-200">
              dx/dt = y - x(x&sup2; + y&sup2; - 1)<br />
              dy/dt = -x - y(x&sup2; + y&sup2; - 1)
            </div>
            <p className="text-slate-700 text-base">
              Convert the vector field to polar coordinates <span className="italic">(r, &theta;)</span> and analyze the asymptotic stability of the limit cycle at <span className="italic">r = 1</span>.
            </p>
          </div>
        </section>
      </div>
    );
  }

  // Passkey Lock Screen (Educational Disguise)
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-cyan-500 selection:text-slate-950">
        {/* Subtle academic header */}
        <header className="border-b border-slate-800/80 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Calculator className="w-4 h-4" />
            </div>
            <div>
              <span className="text-sm font-semibold tracking-wide text-slate-200 uppercase">
                Math 101
              </span>
              <span className="text-xs text-slate-500 ml-2">Academic Course Vault</span>
            </div>
          </div>
          <div className="text-xs text-slate-500 font-mono">SEC-VER: 2026.4</div>
        </header>

        {/* Lock Portal Container */}
        <main className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-2xl p-8 shadow-2xl backdrop-blur-xl">
            <div className="text-center mb-8">
              <div className="w-14 h-14 rounded-2xl bg-sky-500/10 border border-sky-500/30 text-sky-400 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-sky-500/10">
                <Lock className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
                Course Key Required
              </h1>
              <p className="text-sm text-slate-400 max-w-sm mx-auto leading-relaxed">
                Enter your section passkey to access the course laboratory and unblocked simulation library.
              </p>
            </div>

            <form onSubmit={handlePasskeySubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                  Passkey
                </label>
                <div className="relative">
                  <input
                    type={showPasskey ? 'text' : 'password'}
                    value={passkeyInput}
                    onChange={(e) => {
                      setPasskeyInput(e.target.value);
                      if (authError) setAuthError('');
                    }}
                    placeholder="Enter passkey..."
                    autoFocus
                    className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 rounded-xl px-4 py-3 text-slate-100 placeholder:text-slate-600 outline-none transition-all pr-12 font-mono text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasskey(!showPasskey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors p-1 cursor-pointer"
                    title={showPasskey ? 'Hide passkey' : 'Show passkey'}
                  >
                    {showPasskey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {authError && (
                <div className="text-xs text-rose-400 bg-rose-950/40 border border-rose-900/60 rounded-lg p-3">
                  {authError}
                </div>
              )}

              <button
                type="submit"
                disabled={isVerifying}
                className="w-full bg-sky-500 hover:bg-sky-400 active:scale-[0.99] text-slate-950 font-semibold py-3 px-4 rounded-xl transition-all shadow-lg shadow-sky-500/20 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm cursor-pointer"
              >
                {isVerifying ? (
                  <span>Verifying Key...</span>
                ) : (
                  <>
                    <Unlock className="w-4 h-4" />
                    <span>Unlock Portal</span>
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-slate-800/80 text-center">
              <p className="text-xs text-slate-500">
                Authorized students: Contact your instructor or department lab administrator for your course section key.
              </p>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-800/80 px-6 py-4 text-center text-xs text-slate-600">
          Math 101 Laboratory Portal · Protected Academic Environment
        </footer>
      </div>
    );
  }

  // Authenticated Unblocked Games Portal
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-sky-500 selection:text-slate-950 flex flex-col">
      {/* Top Bar: Wordmark - Search/Utilities - Actions */}
      <header className="sticky top-0 z-40 bg-slate-950/85 backdrop-blur-md border-b border-slate-800 px-4 md:px-8 py-3.5 flex items-center justify-between gap-4 md:gap-8">
        {/* Wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-400 to-indigo-600 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-sky-500/20">
            <Gamepad2 className="w-5 h-5 text-slate-950" />
          </div>
          <div>
            <div className="text-base font-extrabold tracking-tight text-white flex items-center gap-2">
              <span>MATH 101</span>
              <span className="text-xs text-sky-400 font-mono font-normal bg-sky-950/60 border border-sky-800/60 px-2 py-0.5 rounded">
                UNBLOCKED
              </span>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="flex-1 max-w-md hidden sm:block">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search 12+ unblocked games, tags, or puzzles..."
              className="w-full bg-slate-900 border border-slate-800 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 rounded-xl pl-9 pr-8 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 outline-none transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Stealth Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setTabCloaked(!tabCloaked)}
            title="Cloak browser tab title to Google Docs"
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              tabCloaked
                ? 'bg-emerald-950/60 border-emerald-700 text-emerald-300'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span className="hidden md:inline">{tabCloaked ? 'Cloaked' : 'Cloak Tab'}</span>
          </button>

          <button
            onClick={() => setIsPanicMode(true)}
            title="Instant Homework Disguise (or press Esc)"
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            <span>Panic [Esc]</span>
          </button>

          <button
            onClick={handleLogout}
            title="Lock Portal and exit"
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-900 rounded-lg transition-colors border border-transparent hover:border-slate-800 cursor-pointer"
          >
            <Lock className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 md:px-8 py-6 space-y-6">
        {/* Mobile Search Input */}
        <div className="sm:hidden">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search unblocked games..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 placeholder:text-slate-500 outline-none"
            />
          </div>
        </div>

        {/* Featured Hero Banner */}
        {!selectedGame && searchQuery === '' && activeCategory === 'All' && !onlyFavorites && (
          <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 p-6 md:p-8 shadow-xl">
            <div className="max-w-2xl space-y-3 relative z-10">
              <div className="text-xs font-semibold tracking-wider uppercase text-sky-400 font-mono">
                Curated JSON Iframe Library
              </div>
              <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
                Unrestricted Web Arcade & Retro Vault
              </h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                Zero external dependencies, zero trackers. Fully self-contained inside responsive sandboxed iframes. Press <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-xs font-mono text-slate-300">Esc</kbd> anytime for stealth math disguise.
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  onClick={() => setSelectedGame(games[0])}
                  className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-sky-500/20 transition-all cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Play Featured: {games[0]?.title}</span>
                </button>
                <div className="text-xs text-slate-400">
                  <span>12 Interactive Games</span>
                  <span className="mx-2 text-slate-600">·</span>
                  <span>100% Offline Capable</span>
                </div>
              </div>
            </div>
            <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-sky-500/10 to-transparent pointer-events-none" />
          </div>
        )}

        {/* Active Game Player Overlay / Theater */}
        {selectedGame && (
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
              {/* Player Top Controls Bar */}
              <div className="px-4 md:px-6 py-3.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-950/60">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSelectedGame(null)}
                    className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                    title="Back to library"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <span>{selectedGame.title}</span>
                      <span className="text-xs text-slate-400 font-normal">
                        ({selectedGame.category})
                      </span>
                    </h3>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleFavorite(selectedGame.id)}
                    className={`p-2 rounded-lg border text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                      favorites.includes(selectedGame.id)
                        ? 'bg-rose-500/20 border-rose-500/40 text-rose-400'
                        : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-slate-200'
                    }`}
                    title={favorites.includes(selectedGame.id) ? 'Remove from favorites' : 'Add to favorites'}
                  >
                    <Heart className={`w-3.5 h-3.5 ${favorites.includes(selectedGame.id) ? 'fill-current' : ''}`} />
                    <span className="hidden sm:inline">Favorite</span>
                  </button>

                  <button
                    onClick={handleReloadGame}
                    className="p-2 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 text-slate-300 hover:text-white transition-colors flex items-center gap-1.5 text-xs cursor-pointer"
                    title="Restart / Reload Game"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Reload</span>
                  </button>

                  <button
                    onClick={() => setIsTheaterMode(!isTheaterMode)}
                    className={`p-2 rounded-lg border text-xs transition-colors flex items-center gap-1.5 cursor-pointer ${
                      isTheaterMode
                        ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                        : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:text-white'
                    }`}
                    title="Toggle Theater Mode"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{isTheaterMode ? 'Compact' : 'Theater'}</span>
                  </button>

                  <button
                    onClick={handleFullscreen}
                    className="p-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold transition-colors flex items-center gap-1.5 text-xs cursor-pointer"
                    title="Fullscreen Mode"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Fullscreen</span>
                  </button>
                </div>
              </div>

              {/* The Iframe Container (Loaded directly from games.json) */}
              <div
                id="game-embed-container"
                className={`relative w-full bg-slate-950 flex items-center justify-center transition-all ${
                  isTheaterMode ? 'h-[80vh]' : 'h-[540px]'
                }`}
              >
                <iframe
                  key={iframeKey}
                  ref={iframeRef}
                  src={selectedGame.iframeSrc}
                  title={selectedGame.title}
                  className="w-full h-full border-0"
                  allow="fullscreen; keyboard; autoplay"
                  sandbox="allow-scripts allow-same-origin allow-forms"
                />
              </div>

              {/* Game Metadata & Controls Drawer */}
              <div className="p-4 md:p-6 bg-slate-900 border-t border-slate-800 flex flex-col md:flex-row gap-6 justify-between">
                <div className="space-y-2 max-w-xl">
                  <div className="text-xs text-slate-400 flex items-center gap-2">
                    <span>{selectedGame.category}</span>
                    <span aria-hidden="true">·</span>
                    <span>Rating: {selectedGame.rating} / 5</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">{selectedGame.plays.toLocaleString()} plays</span>
                  </div>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    {selectedGame.description}
                  </p>
                </div>

                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 min-w-[280px]">
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Controls & Gameplay
                  </div>
                  <ul className="space-y-1.5 text-xs text-slate-300">
                    {selectedGame.controls.map((ctrl, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-sky-400 font-bold">›</span>
                        <span>{ctrl}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Categories & Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-900/90 border border-slate-800 rounded-xl overflow-x-auto max-w-full">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeCategory === cat
                    ? 'bg-sky-500 text-slate-950 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Favorites toggle & Count */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setOnlyFavorites(!onlyFavorites)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                onlyFavorites
                  ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${onlyFavorites ? 'fill-current' : ''}`} />
              <span>Favorites ({favorites.length})</span>
            </button>

            <span className="text-xs text-slate-500 font-mono tabular-nums">
              Showing {filteredGames.length} game{filteredGames.length === 1 ? '' : 's'}
            </span>
          </div>
        </div>

        {/* Games Grid */}
        {filteredGames.length === 0 ? (
          <div className="text-center py-16 bg-slate-900/50 border border-slate-800/80 rounded-2xl">
            <div className="w-12 h-12 rounded-full bg-slate-800 text-slate-500 flex items-center justify-center mx-auto mb-3">
              <Search className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white mb-1">No matching games found</h3>
            <p className="text-xs text-slate-400 mb-4">
              Try adjusting your search query or switching to another category.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setActiveCategory('All');
                setOnlyFavorites(false);
              }}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredGames.map((game) => {
              const isFav = favorites.includes(game.id);
              const isSelected = selectedGame?.id === game.id;

              return (
                <div
                  key={game.id}
                  onClick={() => {
                    setSelectedGame(game);
                    window.scrollTo({ top: 180, behavior: 'smooth' });
                  }}
                  className={`group relative bg-slate-900 border rounded-2xl p-5 cursor-pointer transition-all hover:shadow-xl hover:-translate-y-0.5 flex flex-col justify-between ${
                    isSelected
                      ? 'border-sky-500 shadow-sky-500/10 ring-1 ring-sky-500/50'
                      : 'border-slate-800 hover:border-slate-700 hover:bg-slate-800/60'
                  }`}
                >
                  <div>
                    {/* Header: Category & Favorite */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="text-xs text-slate-400 flex items-center gap-1.5">
                        <span className="font-semibold text-sky-400">{game.category}</span>
                        <span aria-hidden="true" className="text-slate-600">·</span>
                        <span className="text-slate-400 font-mono tabular-nums">{game.rating} ★</span>
                      </div>
                      <button
                        onClick={(e) => toggleFavorite(game.id, e)}
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                          isFav
                            ? 'text-rose-400 hover:bg-rose-500/20'
                            : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                        }`}
                        title={isFav ? 'Remove favorite' : 'Add favorite'}
                      >
                        <Heart className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
                      </button>
                    </div>

                    {/* Title & Description */}
                    <h4 className="text-base font-bold text-white group-hover:text-sky-300 transition-colors mb-1.5">
                      {game.title}
                    </h4>
                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed mb-4">
                      {game.description}
                    </p>
                  </div>

                  <div>
                    {/* Unboxed Metadata & Tags */}
                    <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-1 mb-4">
                      {game.tags.slice(0, 3).map((tag, i) => (
                        <React.Fragment key={tag}>
                          {i > 0 && <span aria-hidden="true" className="text-slate-700">·</span>}
                          <span>{tag}</span>
                        </React.Fragment>
                      ))}
                    </div>

                    {/* Action Button */}
                    <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                      <span className="text-xs text-slate-500 font-mono tabular-nums">
                        {game.plays.toLocaleString()} plays
                      </span>
                      <span className="text-xs font-semibold text-sky-400 group-hover:text-sky-300 flex items-center gap-1">
                        <span>Play Now</span>
                        <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* JSON Architecture Info Banner */}
        <div className="mt-12 rounded-xl bg-slate-900/60 border border-slate-800 p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-slate-200">
              JSON-Driven Iframe Storage Architecture
            </h4>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              Every game is registered in <code className="text-sky-400 font-mono">/games.json</code> with dedicated iframe embeds and attributes. Add or modify games in the JSON repository to dynamically expand the portal catalogue.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <a
              href="/games.json"
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 text-xs font-mono font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors flex items-center gap-1.5"
            >
              <span>View games.json</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-800/80 px-4 md:px-8 py-5 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            <span>Math 101 Unblocked Portal</span>
            <span className="mx-2 text-slate-700">·</span>
            <span>Passkey Protected</span>
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <button
              onClick={() => setIsPanicMode(true)}
              className="hover:text-rose-400 transition-colors cursor-pointer"
            >
              Emergency Disguise (Esc)
            </button>
            <span>·</span>
            <button
              onClick={handleLogout}
              className="hover:text-slate-200 transition-colors cursor-pointer"
            >
              Lock Vault
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
