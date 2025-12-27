import React, { useState, useEffect } from 'react';
import { Target, AlertTriangle, Check, FileText, History, Mail, User as UserIcon, LogOut, Lock, Loader2, UserPlus, Save, X, Receipt, Calendar, CreditCard } from 'lucide-react';
import { Order, PricingConfig, UserProfile } from '../types';
import { isValidEmail, isValidLicense, isValidPhone, formatCurrency, formatShortDate } from '../utils/validation';
import { useToast } from './ui/Toast';

// Firebase Imports
import { auth, db } from '../firebaseConfig';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, User, sendPasswordResetEmail } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

interface Props {
  orders: Order[];
  onOrderSubmit: (order: Omit<Order, 'id' | 'createdAt' | 'transactions' | 'isDelivered'>) => void;
  pricing: PricingConfig;
  currentUser: User | null;
}

export const ShooterSpace: React.FC<Props> = ({ orders, onOrderSubmit, pricing, currentUser }) => {
  const { addToast } = useToast();
  
  // -- Auth State --
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // -- Register / Profile State --
  const [regFirstName, setRegFirstName] = useState('');
  const [regLastName, setRegLastName] = useState('');
  const [regLicense, setRegLicense] = useState('');
  const [regPhone, setRegPhone] = useState('');

  // -- Dashboard State --
  const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // -- New Order Form State --
  // Ces états sont initialisés quand le profil est chargé
  const [qty24, setQty24] = useState(0);
  const [qty28, setQty28] = useState(0);

  // Charger le profil utilisateur quand on est connecté
  useEffect(() => {
    if (currentUser) {
      setProfileLoading(true);
      const fetchProfile = async () => {
        try {
          const docRef = doc(db, 'users', currentUser.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setUserProfile(docSnap.data() as UserProfile);
          } else {
            setUserProfile(null); // Pas de profil trouvé
          }
        } catch (e) {
          console.error("Erreur chargement profil", e);
        } finally {
          setProfileLoading(false);
        }
      };
      fetchProfile();
    } else {
      setUserProfile(null);
    }
  }, [currentUser]);

  // Computed for Cart
  const totalQty = qty24 + qty28;
  const totalAmount = totalQty * pricing.unitPrice;
  const depositAmount = totalQty * pricing.depositPerCarton;
  const isValidQty = totalQty >= pricing.minCartons;

  // -- Auth Handlers --

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);

    try {
      if (isLoginMode) {
        // LOGIN
        await signInWithEmailAndPassword(auth, authEmail, authPassword);
        addToast("Connexion réussie", "success");
      } else {
        // REGISTER
        // 1. Validation des champs d'inscription
        if (!isValidLicense(regLicense)) throw new Error("Format de licence invalide");
        if (!isValidPhone(regPhone)) throw new Error("Format de téléphone invalide");
        if (!regFirstName || !regLastName) throw new Error("Nom et prénom requis");

        // 2. Création compte Auth
        const cred = await createUserWithEmailAndPassword(auth, authEmail, authPassword);
        
        // 3. Création profil Firestore
        const profileData: UserProfile = {
            email: authEmail,
            firstName: regFirstName,
            lastName: regLastName.toUpperCase(),
            licenseNumber: regLicense,
            phone: regPhone
        };
        
        await setDoc(doc(db, 'users', cred.user.uid), profileData);
        // Le useEffect mettra à jour userProfile automatiquement ou on le force ici si besoin
        // setUserProfile(profileData); 
        addToast("Compte créé avec succès !", "success");
      }
    } catch (error: any) {
      console.error(error);
      let msg = "Erreur d'authentification";
      if (error.code === 'auth/email-already-in-use') msg = "Cet email est déjà utilisé.";
      if (error.code === 'auth/wrong-password') msg = "Mot de passe incorrect.";
      if (error.code === 'auth/user-not-found') msg = "Compte introuvable.";
      if (error.code === 'auth/weak-password') msg = "Mot de passe trop faible (6 min).";
      if (error.message && !error.code) msg = error.message; // Custom validations
      addToast(msg, "error");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setAuthLoading(true);

    try {
        if (!isValidLicense(regLicense)) throw new Error("Format de licence invalide");
        if (!isValidPhone(regPhone)) throw new Error("Format de téléphone invalide");
        if (!regFirstName || !regLastName) throw new Error("Nom et prénom requis");

        const profileData: UserProfile = {
            email: currentUser.email || '',
            firstName: regFirstName,
            lastName: regLastName.toUpperCase(),
            licenseNumber: regLicense,
            phone: regPhone
        };
        
        await setDoc(doc(db, 'users', currentUser.uid), profileData);
        setUserProfile(profileData);
        addToast("Profil enregistré !", "success");
    } catch (e: any) {
        addToast(e.message || "Erreur lors de l'enregistrement", "error");
    } finally {
        setAuthLoading(false);
    }
  };

  const handleForgotPassword = async () => {
      if (!authEmail || !isValidEmail(authEmail)) {
          addToast("Veuillez saisir votre email dans le champ ci-dessus", "error");
          return;
      }
      try {
          await sendPasswordResetEmail(auth, authEmail);
          addToast("Email de réinitialisation envoyé", "success");
      } catch(e) {
          addToast("Erreur lors de l'envoi de l'email", "error");
      }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setQty24(0);
    setQty28(0);
    setUserProfile(null);
  };

  // -- Order Handler --

  const handleSubmitOrder = (e: React.FormEvent) => {
    e.preventDefault();

    if (!userProfile) return;
    if (!isValidQty) {
      addToast(`Minimum de ${pricing.minCartons} cartons requis.`, "error");
      return;
    }

    onOrderSubmit({
      firstName: userProfile.firstName,
      lastName: userProfile.lastName,
      licenseNumber: userProfile.licenseNumber,
      phone: userProfile.phone,
      email: userProfile.email,
      qty24g: qty24,
      qty28g: qty28,
      totalAmount,
      depositRequired: depositAmount,
    });
    
    setQty24(0);
    setQty28(0);
    setActiveTab('history');
  };

  // -- RENDER: NOT LOGGED IN --
  if (!currentUser) {
    return (
      <div className="max-w-md mx-auto px-4 py-12">
        <div className="bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden">
          <div className="bg-slate-900 p-6 text-center">
             <div className="w-16 h-16 bg-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                <Target size={32} className="text-white" />
             </div>
             <h1 className="text-2xl font-bold text-white mb-1">Espace Tireur</h1>
             <p className="text-emerald-400 text-sm">Accès Sécurisé</p>
          </div>

          <div className="p-8">
            <div className="flex bg-slate-100 p-1 rounded-lg mb-6">
                <button 
                    onClick={() => setIsLoginMode(true)}
                    className={`flex-1 py-2 text-sm font-bold rounded-md transition ${isLoginMode ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Connexion
                </button>
                <button 
                    onClick={() => setIsLoginMode(false)}
                    className={`flex-1 py-2 text-sm font-bold rounded-md transition ${!isLoginMode ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Créer un compte
                </button>
            </div>

            <form onSubmit={handleAuth} className="space-y-4">
               {/* Login / Register Common Fields */}
               <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email</label>
                  <div className="relative">
                    <input 
                        type="email" 
                        value={authEmail}
                        onChange={(e) => setAuthEmail(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none"
                        placeholder="email@exemple.com"
                        required
                    />
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  </div>
               </div>
               
               <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Mot de passe</label>
                  <div className="relative">
                    <input 
                        type="password" 
                        value={authPassword}
                        onChange={(e) => setAuthPassword(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none"
                        placeholder="••••••••"
                        required
                        minLength={6}
                    />
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  </div>
               </div>

               {/* Register Specific Fields */}
               {!isLoginMode && (
                   <div className="space-y-4 pt-2 border-t border-slate-100 animate-fade-in-up">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Prénom</label>
                                <input type="text" value={regFirstName} onChange={(e) => setRegFirstName(e.target.value)} required className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-slate-900 outline-none" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nom</label>
                                <input type="text" value={regLastName} onChange={(e) => setRegLastName(e.target.value)} required className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-slate-900 outline-none" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Licence FFTir/Ball-Trap</label>
                            <input type="text" value={regLicense} onChange={(e) => setRegLicense(e.target.value)} required placeholder="Ex: 2528974096001" className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-slate-900 outline-none" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Téléphone</label>
                            <input type="tel" value={regPhone} onChange={(e) => setRegPhone(e.target.value)} required placeholder="06XXXXXXXX" className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-slate-900 outline-none" />
                        </div>
                   </div>
               )}

               <button 
                type="submit" 
                disabled={authLoading}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-lg shadow-lg transition flex items-center justify-center gap-2 mt-4"
               >
                 {authLoading ? <Loader2 className="animate-spin" /> : (isLoginMode ? 'Se connecter' : "S'inscrire")}
               </button>
            </form>

            {isLoginMode && (
                <button onClick={handleForgotPassword} className="mt-4 text-xs text-slate-500 hover:text-slate-800 underline w-full text-center">
                    Mot de passe oublié ?
                </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // -- RENDER: LOGGED IN BUT LOADING PROFILE --
  if (profileLoading) {
     return <div className="min-h-[60vh] flex flex-col items-center justify-center text-slate-400 gap-3">
         <Loader2 className="animate-spin" size={40} />
         <p>Chargement de votre profil...</p>
     </div>;
  }

  // -- RENDER: LOGGED IN BUT NO PROFILE --
  // Cas où le compte Auth existe mais pas le document 'users' (ex: compte créé ailleurs ou erreur précédente)
  if (currentUser && !userProfile) {
    return (
        <div className="max-w-md mx-auto px-4 py-12">
            <div className="bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden animate-fade-in-up">
                <div className="bg-amber-500 p-6 text-center text-white">
                    <UserPlus size={48} className="mx-auto mb-2 opacity-90" />
                    <h2 className="text-xl font-bold">Profil Incomplet</h2>
                    <p className="text-amber-100 text-sm">Veuillez finaliser vos informations pour commander.</p>
                </div>
                <div className="p-8">
                    <form onSubmit={handleSaveProfile} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Prénom</label>
                                <input type="text" value={regFirstName} onChange={(e) => setRegFirstName(e.target.value)} required className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none" placeholder="Votre prénom" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nom</label>
                                <input type="text" value={regLastName} onChange={(e) => setRegLastName(e.target.value)} required className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none" placeholder="Votre nom" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Licence</label>
                            <input type="text" value={regLicense} onChange={(e) => setRegLicense(e.target.value)} required placeholder="Ex: 2528974096001" className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Téléphone</label>
                            <input type="tel" value={regPhone} onChange={(e) => setRegPhone(e.target.value)} required placeholder="06XXXXXXXX" className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none" />
                        </div>

                        <button 
                            type="submit"
                            disabled={authLoading} 
                            className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 rounded-lg shadow-lg transition flex items-center justify-center gap-2 mt-4"
                        >
                             {authLoading ? <Loader2 className="animate-spin" /> : <><Save size={18} /> Enregistrer mon profil</>}
                        </button>
                    </form>
                    <div className="mt-4 text-center">
                        <button onClick={handleLogout} className="text-sm text-slate-400 hover:text-slate-600 underline">Se déconnecter</button>
                    </div>
                </div>
            </div>
        </div>
    );
  }

  // -- RENDER: DASHBOARD (LOGGED IN & PROFILE LOADED) --
  
  // Filter Orders for Current User
  // On récupère les commandes liées par ID (nouvelle méthode) OU par email (ancienne méthode legacy)
  // On utilise currentUser.email comme fallback si userProfile est vide (ce qui ne devrait pas arriver ici)
  const userEmail = userProfile.email || currentUser.email || '';
  const myOrders = orders.filter(o => 
    (o.userId === currentUser.uid) || 
    (userEmail && o.email.toLowerCase() === userEmail.toLowerCase())
  ).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      
      {/* Dashboard Header */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
         <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-600">
                <UserIcon size={24} />
            </div>
            <div>
                <h1 className="text-xl font-bold text-slate-900">
                    Bonjour, {userProfile.firstName} !
                </h1>
                <p className="text-sm text-slate-500 flex items-center gap-2">
                    Licence: <span className="font-mono bg-slate-100 px-1 rounded">{userProfile.licenseNumber}</span>
                </p>
            </div>
         </div>
         <button onClick={handleLogout} className="flex items-center gap-2 text-slate-500 hover:text-red-600 transition px-4 py-2 hover:bg-red-50 rounded-lg">
            <LogOut size={18} /> Déconnexion
         </button>
      </div>

      {/* Tabs */}
      <div className="flex bg-white rounded-xl shadow-sm border border-slate-200 p-1 mb-6">
        <button 
            onClick={() => setActiveTab('new')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold rounded-lg transition ${activeTab === 'new' ? 'bg-slate-900 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}
        >
            <FileText size={18} />
            Nouvelle Commande
        </button>
        <button 
            onClick={() => setActiveTab('history')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold rounded-lg transition ${activeTab === 'history' ? 'bg-slate-900 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}
        >
            <History size={18} />
            Historique ({myOrders.length})
        </button>
      </div>

      {/* CONTENT: NEW ORDER */}
      {activeTab === 'new' && (
        <div className="bg-white rounded-xl shadow-xl overflow-hidden border border-slate-200 animate-fade-in-up">
            <div className="bg-slate-50 p-4 border-b border-slate-200 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-600">Prix du jour : <span className="font-bold text-emerald-600">{formatCurrency(pricing.unitPrice)}</span> / carton</span>
                <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-1 rounded-full font-bold">Profil Vérifié</span>
            </div>

            <form onSubmit={handleSubmitOrder} className="p-6 md:p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                    {/* Cart Section */}
                    <div className="bg-military-50 p-6 rounded-xl border border-military-200">
                        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <Target size={18} /> Quantités
                        </h3>
                         
                        <div className="space-y-4">
                            <div className="bg-white p-3 rounded-lg shadow-sm flex items-center justify-between">
                                <span className="font-medium text-slate-700">24 Grammes</span>
                                <div className="flex items-center gap-3">
                                    <button type="button" onClick={() => setQty24(Math.max(0, qty24 - 1))} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold text-slate-600">-</button>
                                    <span className="w-8 text-center font-bold text-xl">{qty24}</span>
                                    <button type="button" onClick={() => setQty24(qty24 + 1)} className="w-8 h-8 rounded-full bg-slate-900 hover:bg-slate-800 flex items-center justify-center font-bold text-white">+</button>
                                </div>
                            </div>
                            <div className="bg-white p-3 rounded-lg shadow-sm flex items-center justify-between">
                                <span className="font-medium text-slate-700">28 Grammes</span>
                                <div className="flex items-center gap-3">
                                    <button type="button" onClick={() => setQty28(Math.max(0, qty28 - 1))} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold text-slate-600">-</button>
                                    <span className="w-8 text-center font-bold text-xl">{qty28}</span>
                                    <button type="button" onClick={() => setQty28(qty28 + 1)} className="w-8 h-8 rounded-full bg-slate-900 hover:bg-slate-800 flex items-center justify-center font-bold text-white">+</button>
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 pt-4 border-t border-military-200 text-sm">
                            <div className="flex justify-between mb-1">
                                <span>Total Cartons</span>
                                <span className={isValidQty ? 'font-bold text-emerald-600' : 'font-bold text-red-500'}>{totalQty} (Min. {pricing.minCartons})</span>
                            </div>
                            <div className="flex justify-between text-lg font-bold text-slate-900">
                                <span>Total</span>
                                <span>{formatCurrency(totalAmount)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Summary & Confirm */}
                    <div className="flex flex-col justify-between">
                        <div className="mb-6">
                            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <UserIcon size={18} /> Coordonnées (Pré-remplies)
                            </h3>
                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-sm space-y-2 text-slate-600">
                                <p><strong className="text-slate-900">Nom :</strong> {userProfile.lastName} {userProfile.firstName}</p>
                                <p><strong className="text-slate-900">Licence :</strong> {userProfile.licenseNumber}</p>
                                <p><strong className="text-slate-900">Email :</strong> {userProfile.email}</p>
                                <p><strong className="text-slate-900">Tel :</strong> {userProfile.phone}</p>
                            </div>
                        </div>

                        <div className="bg-amber-50 p-4 rounded-lg border border-amber-200 mb-4">
                            <div className="flex justify-between items-center text-amber-900">
                                <span className="font-medium">Acompte requis</span>
                                <span className="font-bold text-lg">{formatCurrency(depositAmount)}</span>
                            </div>
                            <p className="text-xs text-amber-700 mt-1">À régler au club pour valider la commande.</p>
                        </div>

                        <button 
                            type="submit" 
                            disabled={!isValidQty}
                            className={`w-full py-4 rounded-lg font-bold text-lg flex items-center justify-center gap-2 shadow-lg transition ${
                            isValidQty 
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                                : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                            }`}
                        >
                            {isValidQty ? <Check size={24} /> : <AlertTriangle size={24} />}
                            {isValidQty ? 'Confirmer la commande' : `Minimum ${pricing.minCartons} cartons`}
                        </button>
                    </div>
                </div>
            </form>
        </div>
      )}

      {/* CONTENT: HISTORY */}
      {activeTab === 'history' && (
        <div className="space-y-4 animate-fade-in-up">
            {myOrders.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                    <History size={48} className="mx-auto text-slate-300 mb-3" />
                    <p className="text-slate-500 font-medium">Vous n'avez pas encore passé de commande.</p>
                    <button onClick={() => setActiveTab('new')} className="text-emerald-600 font-bold hover:underline mt-2">Passer ma première commande</button>
                </div>
            ) : (
                myOrders.map(order => {
                    const totalPaid = order.transactions.reduce((sum, t) => sum + t.amount, 0);
                    const isFullyPaid = totalPaid >= order.totalAmount;
                    const percent = Math.min((totalPaid / order.totalAmount) * 100, 100);

                    return (
                        <div 
                            key={order.id} 
                            onClick={() => setSelectedOrder(order)}
                            className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden cursor-pointer hover:shadow-md hover:border-slate-300 transition group"
                        >
                             <div className="p-4 bg-slate-50 border-b border-slate-100 flex flex-col md:flex-row justify-between md:items-center gap-2 group-hover:bg-slate-100 transition">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-slate-900">Commande du {formatShortDate(order.createdAt)}</span>
                                        <span className="text-xs text-slate-400 font-mono">#{order.id.slice(-6)}</span>
                                    </div>
                                    <div className="text-xs text-slate-500">{order.qty24g + order.qty28g} Cartons</div>
                                </div>
                                <div>
                                    {order.isDelivered ? (
                                        <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1 rounded-full border border-emerald-200">
                                            <Check size={12} /> LIVRÉE
                                        </span>
                                    ) : isFullyPaid ? (
                                        <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-xs font-bold px-3 py-1 rounded-full border border-blue-200">
                                            PAYÉE (À récupérer)
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 text-xs font-bold px-3 py-1 rounded-full border border-amber-200">
                                            EN ATTENTE DE PAIEMENT
                                        </span>
                                    )}
                                </div>
                            </div>
                            
                            <div className="p-4 grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-xs text-slate-500">Détail</p>
                                    <p className="font-medium text-slate-900">{order.qty24g}x 24g, {order.qty28g}x 28g</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-slate-500">Montant</p>
                                    <p className="font-bold text-slate-900">{formatCurrency(order.totalAmount)}</p>
                                </div>
                            </div>
                            
                            <div className="bg-slate-50 px-4 py-2 border-t border-slate-100">
                                 <div className="flex justify-between items-center text-xs mb-1">
                                    <span className="text-slate-500">Règlement ({Math.round(percent)}%)</span>
                                    <span className={isFullyPaid ? "text-emerald-600 font-bold" : "text-amber-600 font-bold"}>
                                        {formatCurrency(totalPaid)} / {formatCurrency(order.totalAmount)}
                                    </span>
                                 </div>
                                 <div className="w-full bg-slate-200 rounded-full h-1.5">
                                    <div className={`h-1.5 rounded-full ${isFullyPaid ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{width: `${percent}%`}}></div>
                                 </div>
                                 <div className="mt-2 text-center text-xs text-slate-400 font-medium group-hover:text-slate-600 transition">
                                     Cliquez pour voir le détail
                                 </div>
                            </div>
                        </div>
                    );
                })
            )}
        </div>
      )}

      {/* DETAIL MODAL */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedOrder(null)} />
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg relative z-10 overflow-hidden animate-fade-in-up flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="bg-slate-900 p-6 flex justify-between items-start">
               <div>
                 <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Receipt className="text-emerald-400" size={24} />
                    Détail Commande
                 </h2>
                 <p className="text-slate-400 text-sm mt-1">
                    {formatShortDate(selectedOrder.createdAt)} • <span className="font-mono">#{selectedOrder.id.slice(-6)}</span>
                 </p>
               </div>
               <button 
                  onClick={() => setSelectedOrder(null)}
                  className="p-2 bg-white/10 text-white hover:bg-white/20 rounded-full transition"
               >
                  <X size={20} />
               </button>
            </div>

            <div className="overflow-y-auto p-6 space-y-6">
                
                {/* Product Breakdown */}
                <div>
                   <h3 className="text-sm font-bold text-slate-900 uppercase mb-3 flex items-center gap-2">
                       <Target size={16} /> Contenu
                   </h3>
                   <div className="bg-slate-50 rounded-lg border border-slate-200 overflow-hidden">
                       <div className="flex justify-between p-3 border-b border-slate-200 bg-white">
                           <span className="text-slate-600">Cartons 24g</span>
                           <span className="font-bold text-slate-900">x {selectedOrder.qty24g}</span>
                       </div>
                       <div className="flex justify-between p-3 border-b border-slate-200 bg-white">
                           <span className="text-slate-600">Cartons 28g</span>
                           <span className="font-bold text-slate-900">x {selectedOrder.qty28g}</span>
                       </div>
                       <div className="flex justify-between p-3 bg-slate-100">
                           <span className="font-bold text-slate-700">Total Commande</span>
                           <span className="font-bold text-slate-900">{formatCurrency(selectedOrder.totalAmount)}</span>
                       </div>
                   </div>
                </div>

                {/* Payment Status */}
                <div>
                    <h3 className="text-sm font-bold text-slate-900 uppercase mb-3 flex items-center gap-2">
                       <CreditCard size={16} /> Statut Paiement
                   </h3>
                   {(() => {
                        const totalPaid = selectedOrder.transactions.reduce((sum, t) => sum + t.amount, 0);
                        const remaining = selectedOrder.totalAmount - totalPaid;
                        const isPaid = remaining <= 0;
                        const percent = Math.min((totalPaid / selectedOrder.totalAmount) * 100, 100);

                        return (
                            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
                                <div className="flex justify-between items-end mb-2">
                                    <div>
                                        <div className="text-xs text-slate-500 uppercase font-bold">Reste à payer</div>
                                        <div className={`text-xl font-bold ${isPaid ? 'text-emerald-600' : 'text-amber-600'}`}>
                                            {isPaid ? 'Réglé' : formatCurrency(remaining)}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs text-slate-500">Versé</div>
                                        <div className="font-semibold text-slate-900">{formatCurrency(totalPaid)}</div>
                                    </div>
                                </div>
                                <div className="w-full bg-slate-200 rounded-full h-2">
                                    <div className={`h-2 rounded-full ${isPaid ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{width: `${percent}%`}}></div>
                                </div>
                            </div>
                        );
                   })()}
                </div>

                {/* Transaction History */}
                <div>
                    <h3 className="text-sm font-bold text-slate-900 uppercase mb-3 flex items-center gap-2">
                       <History size={16} /> Historique des versements
                   </h3>
                   {selectedOrder.transactions.length === 0 ? (
                       <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-lg text-slate-400 text-sm">
                           Aucun versement enregistré
                       </div>
                   ) : (
                       <div className="space-y-2">
                           {selectedOrder.transactions
                             .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                             .map((t, idx) => (
                               <div key={idx} className="flex justify-between items-center p-3 bg-white border border-slate-100 rounded-lg shadow-sm">
                                   <div className="flex items-center gap-3">
                                       <div className="bg-slate-100 p-2 rounded text-slate-500">
                                           <Calendar size={16} />
                                       </div>
                                       <div>
                                           <div className="font-medium text-slate-900">{t.method}</div>
                                           <div className="text-xs text-slate-500">{formatShortDate(t.date)}</div>
                                       </div>
                                   </div>
                                   <div className="font-bold text-slate-900">
                                       {formatCurrency(t.amount)}
                                   </div>
                               </div>
                           ))}
                       </div>
                   )}
                </div>

            </div>
            
            {/* Footer Status */}
            <div className="bg-slate-50 p-4 border-t border-slate-200 text-center">
                {selectedOrder.isDelivered ? (
                    <span className="inline-flex items-center gap-2 text-emerald-700 font-bold bg-emerald-100 px-4 py-2 rounded-full">
                        <Check size={18} /> Commande Livrée
                    </span>
                ) : (
                    <span className="inline-flex items-center gap-2 text-amber-700 font-bold bg-amber-100 px-4 py-2 rounded-full">
                        <Loader2 size={18} className="animate-spin-slow" /> En cours de traitement
                    </span>
                )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
};