import React, { useState, useEffect } from 'react';
import { Heart, Sparkles, LogOut, Copy, Check, ChevronRight, Loader, UserPlus, LogIn } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// Emotion config
const emotions = [
  { id: 'happy', label: 'Šťastný', color: '#FCD34D', symbol: '😊', bgGradient: 'from-yellow-50 to-orange-50' },
  { id: 'loved', label: 'Milovaný', color: '#F87171', symbol: '💕', bgGradient: 'from-red-50 to-pink-50' },
  { id: 'calm', label: 'Klidný', color: '#93C5FD', symbol: '🌿', bgGradient: 'from-blue-50 to-cyan-50' },
  { id: 'excited', label: 'Nadšený', color: '#C4B5FD', symbol: '✨', bgGradient: 'from-purple-50 to-pink-50' },
  { id: 'sad', label: 'Smutný', color: '#A1A1AA', symbol: '😢', bgGradient: 'from-gray-50 to-blue-50' },
  { id: 'anxious', label: 'Nervózní', color: '#F97316', symbol: '😰', bgGradient: 'from-orange-50 to-red-50' },
];

export default function CoulexApp() {
  const [page, setPage] = useState('auth');
  const [authTab, setAuthTab] = useState('login');
  const [loginCode, setLoginCode] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [currentUser, setCurrentUser] = useState(null);
  const [userCode, setUserCode] = useState('');
  const [partner, setPartner] = useState(null);
  const [partnerCode, setPartnerCode] = useState('');
  const [partnershipId, setPartnershipId] = useState(null);
  const [isCodeCopied, setIsCodeCopied] = useState(false);
  const [selectedEmotion, setSelectedEmotion] = useState(null);
  const [emotionDescription, setEmotionDescription] = useState('');
  const [emotions_list, setEmotionsList] = useState([]);

  // Check saved user
  useEffect(() => {
    const savedUser = localStorage.getItem('couplex_user');
    if (savedUser) {
      try {
        const userData = JSON.parse(savedUser);
        setCurrentUser(userData);
        setUserCode(userData.unique_code);
        setPage('dashboard');
        fetchUserData(userData.id);
      } catch (err) {
        localStorage.removeItem('couplex_user');
      }
    }
  }, []);

  // Real-time subscription
  useEffect(() => {
    if (!partnershipId) return;

    const subscription = supabase
      .channel(`emotions-${partnershipId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'emotions',
          filter: `partnership_id=eq.${partnershipId}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setEmotionsList(prev => [payload.new, ...prev]);
          }
        }
      )
      .subscribe();

    return () => subscription.unsubscribe();
  }, [partnershipId]);

  const fetchUserData = async (userId) => {
    try {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (userError) throw userError;
      setCurrentUser(userData);
      setUserCode(userData.unique_code);
      
      const partnerResult = await supabase
        .rpc('get_partner_info', {
          p_user_id: String(userData.id)
        });
      
      if (partnerResult.data?.success) {
        setPartner(partnerResult.data);
        setPartnershipId(partnerResult.data.partnership_id);
        fetchEmotions(partnerResult.data.partnership_id);
      } else {
        setPartner(null);
        setPartnershipId(null);
      }
    } catch (err) {
      console.error('Error fetching user data:', err);
    }
  };

  const fetchEmotions = async (pid) => {
    if (!pid) return;
    try {
      const { data, error } = await supabase
        .from('emotions')
        .select('*, shared_by:shared_by_id(username)')
        .eq('partnership_id', pid)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEmotionsList(data || []);
    } catch (err) {
      console.error('Error fetching emotions:', err);
    }
  };

  // 🔥 REGISTRACE - POUZE JMÉNO, KÓD GENERUJE DATABÁZE!
  const handleSignUp = async (e) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('Zadej uživatelské jméno');
      return;
    }
    
    setLoading(true);
    setError('');

    try {
      const { data, error } = await supabase
        .rpc('create_user', {
          p_username: username.trim()
        });

      if (error) throw error;
      
      if (!data.success) {
        setError(data.error || 'Chyba při registraci');
        return;
      }

      // Uložit uživatele
      localStorage.setItem('couplex_user', JSON.stringify(data));
      
      setCurrentUser(data);
      setUserCode(data.unique_code);
      setUsername('');
      setPage('dashboard');
      
    } catch (err) {
      setError(err.message || 'Chyba při registraci');
    } finally {
      setLoading(false);
    }
  };

  // 🔥 PŘIHLÁŠENÍ - POUZE KÓD!
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!loginCode.trim()) {
      setError('Zadej přihlašovací kód');
      return;
    }
    
    setLoading(true);
    setError('');

    try {
      const { data, error } = await supabase
        .rpc('login_by_code', {
          p_code: loginCode.toUpperCase()
        });

      if (error) throw error;
      
      if (!data.success) {
        setError(data.error || 'Neplatný kód');
        return;
      }

      localStorage.setItem('couplex_user', JSON.stringify(data));
      
      setCurrentUser(data);
      setUserCode(data.unique_code);
      setLoginCode('');
      setPage('dashboard');
      
      await fetchUserData(data.id);
      
    } catch (err) {
      setError(err.message || 'Chyba při přihlášení');
    } finally {
      setLoading(false);
    }
  };

  const handleConnectPartner = async () => {
    if (!partnerCode.trim()) return;
    setLoading(true);
    setError('');

    try {
      const { data, error } = await supabase
        .rpc('create_partnership_by_code', {
          p_user_id: String(currentUser.id),
          p_partner_code: partnerCode.toUpperCase()
        });

      if (error) throw error;

      if (!data?.success) {
        setError(data?.error || 'Spojení se nezdařilo');
        return;
      }

      setPartnerCode('');
      await fetchUserData(currentUser.id);
      
    } catch (err) {
      setError(err.message || 'Chyba při připojení k partnerovi');
    } finally {
      setLoading(false);
    }
  };

  const handleShareEmotion = async () => {
    if (!selectedEmotion || !emotionDescription.trim() || !partnershipId) return;
    setLoading(true);

    try {
      const { error } = await supabase
        .from('emotions')
        .insert([{
          partnership_id: partnershipId,
          shared_by_id: currentUser.id,
          emotion_type: selectedEmotion,
          description: emotionDescription,
        }]);

      if (error) throw error;

      setSelectedEmotion(null);
      setEmotionDescription('');
      setPage('dashboard');
      
    } catch (err) {
      setError(err.message || 'Chyba při sdílení emoce');
    } finally {
      setLoading(false);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(userCode);
    setIsCodeCopied(true);
    setTimeout(() => setIsCodeCopied(false), 2000);
  };

  const handleLogout = () => {
    localStorage.removeItem('couplex_user');
    setCurrentUser(null);
    setPartner(null);
    setPartnershipId(null);
    setEmotionsList([]);
    setPage('auth');
    setAuthTab('login');
    setLoginCode('');
  };

  // ==================== RENDER: LOGIN/SIGNUP ====================
  if (page === 'auth') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-amber-50 flex items-center justify-center p-4">
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Outfit:wght@300;400;500;600&display=swap');
          * { font-family: 'Outfit', sans-serif; }
          .heading { font-family: 'Playfair Display', serif; }
          
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          
          .animate-fade-in { animation: fadeInUp 0.6s ease-out; }
          input:focus { outline: none; box-shadow: 0 0 0 3px rgba(236, 72, 153, 0.1); }
          button:active { transform: scale(0.98); }
        `}</style>

        <div className="w-full max-w-sm animate-fade-in">
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-rose-300 to-pink-300 rounded-full mb-6 shadow-lg">
              <Heart className="w-8 h-8 text-white" fill="white" />
            </div>
            <h1 className="heading text-4xl font-bold text-gray-900 mb-2">Couplex</h1>
            <p className="text-gray-600 text-sm tracking-wide">Sdílej emoce s partnerem</p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8">
            {error && (
              <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Tabs - JENOM KÓD, ŽÁDNÝ EMAIL/HESLO */}
            <div className="flex gap-4 mb-6">
              <button
                onClick={() => setAuthTab('login')}
                className={`flex-1 py-2 rounded-lg font-semibold transition-colors ${
                  authTab === 'login'
                    ? 'bg-rose-400 text-white'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                <LogIn className="w-4 h-4 inline mr-2" />
                Mám kód
              </button>
              <button
                onClick={() => setAuthTab('signup')}
                className={`flex-1 py-2 rounded-lg font-semibold transition-colors ${
                  authTab === 'signup'
                    ? 'bg-rose-400 text-white'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                <UserPlus className="w-4 h-4 inline mr-2" />
                Nový kód
              </button>
            </div>

            {/* Form - POUZE KÓD + JMÉNO */}
            <form onSubmit={authTab === 'login' ? handleLogin : handleSignUp} className="space-y-4">
              {authTab === 'signup' ? (
                /* REGISTRACE - POUZE JMÉNO */
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Tvoje jméno
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Jak ti říkají?"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900"
                    autoFocus
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Po registraci dostaneš svůj UNIKÁTNÍ 8místný kód
                  </p>
                </div>
              ) : (
                /* PŘIHLÁŠENÍ - POUZE KÓD */
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Tvůj přihlašovací kód
                  </label>
                  <input
                    type="text"
                    value={loginCode}
                    onChange={(e) => setLoginCode(e.target.value.toUpperCase())}
                    placeholder="např. ABC123XY"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 uppercase tracking-wider"
                    autoFocus
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Zadej 8místný kód, který jsi dostal při registraci
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-rose-400 to-pink-400 text-white font-semibold rounded-xl hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader className="w-4 h-4 animate-spin" /> : null}
                {authTab === 'login' ? 'Přihlásit se kódem' : 'Vytvořit účet'}
              </button>
            </form>

            {/* Info box */}
            <div className="mt-6 p-4 bg-amber-50 rounded-lg border border-amber-200">
              <p className="text-xs text-amber-800">
                <strong className="block mb-1">🔐 Jednoduché přihlašování</strong>
                Žádný email, žádné heslo! Stačí tvůj unikátní kód. 
                {authTab === 'signup' ? ' Po registraci ho uvidíš na dashboardu.' : ' Nemáš kód? Vytvoř si nový účet.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==================== RENDER: DASHBOARD ====================
  if (page === 'dashboard') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-amber-50 pb-24">
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Outfit:wght@300;400;500;600&display=swap');
          * { font-family: 'Outfit', sans-serif; }
          .heading { font-family: 'Playfair Display', serif; }
          
          @keyframes slideInDown { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes slideInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes pulse-soft { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
          
          .animate-slide-down { animation: slideInDown 0.5s ease-out; }
          .animate-slide-up { animation: slideInUp 0.5s ease-out; }
          .animate-pulse-soft { animation: pulse-soft 2s ease-in-out infinite; }
        `}</style>

        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-b from-white to-rose-50 backdrop-blur-sm border-b border-rose-100 p-6 animate-slide-down">
          <div className="max-w-md mx-auto flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-widest">Přihlášen/a</p>
              <h2 className="heading text-2xl font-bold text-gray-900">{currentUser?.username}</h2>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 hover:bg-rose-100 rounded-full transition-colors"
            >
              <LogOut className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        <div className="max-w-md mx-auto p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* TVŮJ UNIKÁTNÍ KÓD - VŽDY VIDITELNÝ */}
          <div className="bg-gradient-to-br from-rose-100 via-pink-100 to-rose-100 rounded-2xl shadow-lg p-6 animate-slide-up border-2 border-rose-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-rose-500" />
                <h3 className="font-semibold text-gray-900">Tvůj unikátní kód</h3>
              </div>
              <button
                onClick={copyCode}
                className="p-2 hover:bg-rose-200 rounded-lg transition-colors"
              >
                {isCodeCopied ? (
                  <Check className="w-5 h-5 text-green-600" />
                ) : (
                  <Copy className="w-5 h-5 text-gray-600" />
                )}
              </button>
            </div>
            
            <div className="bg-white rounded-xl p-4 text-center">
              <code className="heading text-3xl md:text-4xl font-bold text-gray-900 tracking-[0.3em]">
                {userCode}
              </code>
            </div>
            
            <p className="text-xs text-gray-600 mt-3 text-center">
              🔑 Tento kód je tvůj klíč k přihlášení. Nikomu ho nedávej!
            </p>
          </div>

          {/* Partner Connection */}
          {!partner?.success ? (
            <div className="bg-white rounded-2xl shadow-lg p-6 space-y-4 animate-slide-up border-l-4 border-amber-400">
              <div className="flex items-start space-x-3">
                <Heart className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-gray-900">Připoj se k partnerovi</h3>
                  <p className="text-sm text-gray-600 mt-1">Vyměňte si kódy a začněte sdílet emoce</p>
                </div>
              </div>

              {/* Partner Code Input */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Kód partnera
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={partnerCode}
                    onChange={(e) => setPartnerCode(e.target.value.toUpperCase())}
                    placeholder="8místný kód..."
                    className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 uppercase tracking-wider"
                  />
                  <button
                    onClick={handleConnectPartner}
                    disabled={loading || !partnerCode.trim()}
                    className="px-4 py-3 bg-amber-400 text-white font-semibold rounded-xl hover:bg-amber-500 transition-colors disabled:opacity-50 flex items-center justify-center"
                  >
                    {loading ? <Loader className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-5 h-5" />}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Požádej partnera o jeho kód a zadej ho sem
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-gradient-to-br from-rose-100 to-pink-100 rounded-2xl shadow-lg p-6 text-center animate-slide-up">
              <Heart className="w-8 h-8 text-rose-500 mx-auto mb-2 animate-pulse-soft" fill="currentColor" />
              <h3 className="font-semibold text-gray-900">
                Spojen/a s {partner?.partner_name}
              </h3>
              <p className="text-sm text-gray-700 mt-1">
                Můžete si sdílet emoce ❤️
              </p>
            </div>
          )}

          {/* Share Emotion Button */}
          {partner?.success && (
            <button
              onClick={() => setPage('emotions')}
              className="w-full py-4 bg-gradient-to-r from-rose-400 to-pink-400 text-white font-semibold rounded-2xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center space-x-2 animate-slide-up"
            >
              <Heart className="w-5 h-5" fill="white" />
              <span>Sdílej svou emoci</span>
            </button>
          )}

          {/* Shared Emotions */}
          {emotions_list.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-widest flex items-center space-x-2">
                <Heart className="w-4 h-4 text-rose-400" />
                <span>Sdílené emoce</span>
              </h3>
              {emotions_list.map((emotion, idx) => {
                const emotionInfo = emotions.find(e => e.id === emotion.emotion_type);
                return (
                  <div
                    key={emotion.id}
                    className={`bg-gradient-to-br ${emotionInfo.bgGradient} rounded-2xl p-4 border-l-4 animate-slide-up`}
                    style={{ borderColor: emotionInfo.color, animationDelay: `${idx * 50}ms` }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="text-xl">{emotionInfo.symbol}</span>
                          <p className="font-semibold text-gray-900">
                            {emotion.shared_by?.username}: {emotionInfo.label}
                          </p>
                        </div>
                        <p className="text-sm text-gray-700 leading-relaxed">{emotion.description}</p>
                        <p className="text-xs text-gray-500 mt-2">
                          {new Date(emotion.created_at).toLocaleTimeString('cs-CZ', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ==================== RENDER: EMOTIONS PAGE ====================
  if (page === 'emotions') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-amber-50 pb-24">
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Outfit:wght@300;400;500;600&display=swap');
          * { font-family: 'Outfit', sans-serif; }
          .heading { font-family: 'Playfair Display', serif; }
          
          @keyframes slideInDown { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes slideInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes scaleIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
          
          .animate-slide-down { animation: slideInDown 0.5s ease-out; }
          .animate-slide-up { animation: slideInUp 0.5s ease-out; }
          .animate-scale-in { animation: scaleIn 0.4s ease-out; }
          
          .emotion-btn {
            transition: all 0.3s ease;
            border: 2px solid transparent;
          }
          
          .emotion-btn.selected { transform: scale(1.05); border-color: currentColor; }
          .emotion-btn:active { transform: scale(0.95); }
        `}</style>

        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-b from-white to-rose-50 backdrop-blur-sm border-b border-rose-100 p-6 animate-slide-down">
          <div className="max-w-md mx-auto flex items-center space-x-4">
            <button
              onClick={() => setPage('dashboard')}
              className="text-gray-500 hover:text-gray-900 transition-colors text-2xl"
            >
              ←
            </button>
            <h2 className="heading text-2xl font-bold text-gray-900 flex-1">Jak se cítíš?</h2>
          </div>
        </div>

        <div className="max-w-md mx-auto p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Emotion Selector */}
          <div className="space-y-3 animate-slide-up">
            <p className="text-sm font-semibold text-gray-700 uppercase tracking-widest">Vyber emoci</p>
            <div className="grid grid-cols-3 gap-3">
              {emotions.map((emotion) => (
                <button
                  key={emotion.id}
                  onClick={() => setSelectedEmotion(emotion.id)}
                  className={`emotion-btn flex flex-col items-center justify-center p-4 rounded-2xl shadow-md hover:shadow-lg transition-all ${
                    selectedEmotion === emotion.id ? 'selected ring-2 ring-offset-2 ring-rose-300' : 'bg-white'
                  }`}
                  style={{
                    backgroundColor: selectedEmotion === emotion.id ? emotion.color + '20' : 'white',
                    borderColor: emotion.color,
                  }}
                >
                  <span className="text-3xl mb-1">{emotion.symbol}</span>
                  <span className="text-xs font-semibold text-gray-900 text-center leading-tight">
                    {emotion.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          {selectedEmotion && (
            <div className="animate-scale-in space-y-3">
              <label className="block text-sm font-semibold text-gray-700 uppercase tracking-widest">
                Krátký popis
              </label>
              <textarea
                value={emotionDescription}
                onChange={(e) => setEmotionDescription(e.target.value.slice(0, 200))}
                placeholder="Co tě právě rozesmálo? Co tě trápí? Sdílej detaily..."
                className="w-full px-4 py-4 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-rose-300"
                rows="4"
              />
              <p className="text-xs text-gray-500">{emotionDescription.length}/200</p>
            </div>
          )}

          {/* Share Button */}
          {selectedEmotion && emotionDescription.trim() && (
            <button
              onClick={handleShareEmotion}
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-rose-400 to-pink-400 text-white font-semibold rounded-2xl shadow-lg hover:shadow-xl transition-all animate-slide-up flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              {loading ? <Loader className="w-5 h-5 animate-spin" /> : <Heart className="w-5 h-5" fill="white" />}
              <span>Sdílej s {partner?.partner_name}</span>
            </button>
          )}
        </div>
      </div>
    );
  }
}