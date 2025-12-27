import React, { useState, useEffect } from 'react';
import { Lock, LogOut, Search, Download, CheckCircle, Truck, Wallet, Eye, EyeOff, Mail, Loader2, Settings, ShieldAlert, UserPlus, Trash2, AlertTriangle, Package } from 'lucide-react';
import { Order, Transaction, PricingConfig } from '../types';
import { useToast } from './ui/Toast';
import { formatCurrency, formatShortDate } from '../utils/validation';
import { TransactionHistoryDrawer } from './TransactionHistoryDrawer';

// Firebase Imports
import { auth, db } from '../firebaseConfig';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

interface Props {
  orders: Order[];
  onLogout: () => void;
  onUpdateOrder: (order: Order) => void;
  onDeleteOrder: (id: string) => void;
  pricing: PricingConfig;
  onUpdatePricing: (config: PricingConfig, updateExisting: boolean) => Promise<void>;
}

// Interface simplifiée pour l'utilisateur admin
interface AdminUser {
  uid: string;
  email: string | null;
}

export const AdminSpace: React.FC<Props> = ({ orders, onLogout, onUpdateOrder, onDeleteOrder, pricing, onUpdatePricing }) => {
  // Auth State
  const [user, setUser] = useState<AdminUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  // Admin Rights Verification State
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingRights, setCheckingRights] = useState(false);

  // Login/Register Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  
  const { addToast } = useToast();
  
  // Dashboard state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrderForPayment, setSelectedOrderForPayment] = useState<Order | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
  
  // Settings Modal State
  const [showSettings, setShowSettings] = useState(false);
  const [editPricing, setEditPricing] = useState<PricingConfig>(pricing);
  const [updateExistingOrders, setUpdateExistingOrders] = useState(false);

  // Sync editPricing when prop changes
  useEffect(() => {
    setEditPricing(pricing);
  }, [pricing]);

  // Check auth state on mount
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser({
          uid: currentUser.uid,
          email: currentUser.email
        });
        
        // Vérification des droits admin dans Firestore
        if (currentUser.email) {
          setCheckingRights(true);
          try {
            // On cherche un document dans la collection 'admins' dont l'ID est l'email
            const adminDocRef = doc(db, 'admins', currentUser.email);
            const adminSnap = await getDoc(adminDocRef);
            
            if (adminSnap.exists()) {
              setIsAdmin(true);
            } else {
              setIsAdmin(false);
            }
          } catch (error) {
            console.error("Erreur vérification admin:", error);
            setIsAdmin(false);
          } finally {
            setCheckingRights(false);
          }
        }
      } else {
        setUser(null);
        setIsAdmin(false);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Auth Handler (Login & Register)
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    
    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, email, password);
        addToast('Compte créé avec succès', 'success');
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        addToast('Connexion réussie', 'success');
      }
      // L'état 'user' sera mis à jour automatiquement par onAuthStateChanged
    } catch (error: any) {
      console.error("Auth Error:", error);
      
      // Gestion spécifique : Si l'email existe déjà lors de l'inscription
      if (error.code === 'auth/email-already-in-use') {
        addToast("Cet email possède déjà un compte. Tentative de connexion...", "info");
        setIsRegistering(false); // Bascule en mode connexion
        
        // Tentative immédiate de connexion avec les mêmes identifiants
        try {
          await signInWithEmailAndPassword(auth, email, password);
          addToast("Connexion réussie", "success");
          return; // Sortie anticipée en cas de succès
        } catch (loginError: any) {
          if (loginError.code === 'auth/wrong-password' || loginError.code === 'auth/invalid-credential') {
             addToast("Compte existant : Mot de passe incorrect", "error");
          } else {
             addToast("Veuillez vous connecter", "info");
          }
        }
      } else {
        // Autres erreurs standards
        let msg = "Erreur d'authentification";
        if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
          msg = "Email ou mot de passe incorrect";
        } else if (error.code === 'auth/weak-password') {
          msg = "Le mot de passe doit contenir au moins 6 caractères";
        } else if (error.code === 'auth/too-many-requests') {
          msg = "Trop de tentatives. Réessayez plus tard.";
        }
        addToast(msg, 'error');
      }
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      onLogout();
      addToast("Déconnexion réussie", "info");
    } catch (e) {
      addToast("Erreur lors de la déconnexion", "error");
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await onUpdatePricing(editPricing, updateExistingOrders);
    setShowSettings(false);
    setUpdateExistingOrders(false);
  };

  // Logic Handlers
  const handleAddTransaction = (orderId: string, transactionData: Omit<Transaction, 'id' | 'addedBy'>) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    const newTransaction: Transaction = {
      ...transactionData,
      id: Date.now().toString(),
      addedBy: user?.email || 'Admin'
    };

    const updatedOrder = {
      ...order,
      transactions: [...order.transactions, newTransaction]
    };

    onUpdateOrder(updatedOrder);
    setSelectedOrderForPayment(updatedOrder);
    addToast('Transaction ajoutée', 'success');
  };

  const handleDeleteTransaction = (orderId: string, transactionId: string) => {
      const order = orders.find(o => o.id === orderId);
      if(!order) return;

      const updatedOrder = {
          ...order,
          transactions: order.transactions.filter(t => t.id !== transactionId)
      };

      onUpdateOrder(updatedOrder);
      setSelectedOrderForPayment(updatedOrder);
      addToast('Transaction supprimée', 'info');
  };

  const toggleDelivery = (order: Order) => {
    const totalPaid = order.transactions.reduce((sum, t) => sum + t.amount, 0);
    if (totalPaid < order.totalAmount) {
        addToast("Impossible de livrer : commande non soldée.", "error");
        return;
    }

    const updatedOrder = { 
        ...order, 
        isDelivered: !order.isDelivered,
        deliveryDate: !order.isDelivered ? new Date().toISOString() : undefined
    };
    onUpdateOrder(updatedOrder);
    addToast(updatedOrder.isDelivered ? 'Commande marquée livrée' : 'Livraison annulée', 'success');
  };

  const handleExportCSV = () => {
    const headers = ['Date Cde', 'Nom', 'Prénom', 'Licence', '24g', '28g', 'Total', 'Total Versé', 'Reste', 'Dernier Paiement', 'Livré'];
    const rows = orders.map(o => {
      const totalPaid = o.transactions.reduce((sum, t) => sum + t.amount, 0);
      const lastPayment = o.transactions.length > 0 
        ? formatShortDate(o.transactions.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].date)
        : '-';

      return [
        formatShortDate(o.createdAt),
        o.lastName,
        o.firstName,
        o.licenseNumber,
        o.qty24g,
        o.qty28g,
        o.totalAmount,
        totalPaid,
        o.totalAmount - totalPaid,
        lastPayment,
        o.isDelivered ? 'OUI' : 'NON'
      ].join(';');
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(';'), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `ammocommand_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
  };

  // Filtered Data
  const filteredOrders = orders.filter(o => 
    o.lastName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    o.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.licenseNumber.includes(searchTerm)
  );

  // Statistics
  const stats = {
    totalRevenue: orders.reduce((acc, o) => acc + o.totalAmount, 0),
    collected: orders.reduce((acc, o) => acc + o.transactions.reduce((s, t) => s + t.amount, 0), 0),
    pendingDelivery: orders.filter(o => !o.isDelivered).length,
    totalCartons: orders.reduce((acc, o) => acc + o.qty24g + o.qty28g, 0),
    total24g: orders.reduce((acc, o) => acc + o.qty24g, 0),
    total28g: orders.reduce((acc, o) => acc + o.qty28g, 0)
  };

  if (authLoading) {
    return <div className="min-h-[60vh] flex items-center justify-center text-slate-400"><Loader2 className="animate-spin" /></div>;
  }

  // --- 1. Écran de Connexion / Inscription ---
  if (!user) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-2xl max-w-sm w-full border border-slate-200">
          <div className="flex justify-center mb-6">
            <div className="bg-slate-900 p-4 rounded-xl shadow-lg">
               <Lock size={32} className="text-white" />
            </div>
          </div>
          
          <h2 className="text-2xl font-bold text-center text-slate-800 mb-2">Espace Admin</h2>
          <p className="text-center text-slate-400 text-sm mb-8">
            {isRegistering ? "Créer un nouveau compte" : "Connectez-vous à votre compte"}
          </p>
          
          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email</label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="exemple@email.com"
                  className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none transition"
                  required
                />
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Mot de passe</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none transition"
                  required
                  minLength={6}
                />
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full bg-slate-900 text-white py-3 rounded-lg font-bold hover:bg-slate-800 transition shadow-lg mt-2 flex justify-center items-center gap-2"
            >
              {loginLoading && <Loader2 size={18} className="animate-spin" />}
              {loginLoading ? 'Patientez...' : (isRegistering ? 'Créer le compte' : 'Se connecter')}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <button 
              type="button"
              onClick={() => {
                setIsRegistering(!isRegistering);
                setEmail('');
                setPassword('');
              }}
              className="text-sm font-medium text-slate-500 hover:text-emerald-600 transition flex items-center justify-center gap-2 w-full"
            >
              {isRegistering ? (
                <>Déjà un compte ? <span className="underline">Se connecter</span></>
              ) : (
                <><UserPlus size={16} /> Pas de compte ? <span className="underline">Créer un accès</span></>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- 2. Vérification des Droits Admin ---
  // On affiche un loader pendant la vérification dans Firestore
  if (checkingRights) {
    return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center text-slate-500 gap-3">
            <Loader2 className="animate-spin" size={32} />
            <p className="text-sm font-medium">Vérification des droits d'administration...</p>
        </div>
    );
  }

  // Si l'utilisateur est connecté mais n'a pas été trouvé dans la collection 'admins'
  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto mt-20 px-4">
        <div className="bg-white p-8 rounded-xl shadow-xl border border-red-100 text-center">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldAlert size={32} className="text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Accès Restreint</h2>
          <p className="text-slate-600 mb-6">
            Vous êtes connecté en tant que <strong>{user.email}</strong>, mais ce compte ne figure pas dans la liste des administrateurs autorisés.
          </p>
          <div className="p-4 bg-slate-50 rounded text-sm text-slate-500 mb-6">
            Si vous pensez qu'il s'agit d'une erreur, demandez à un administrateur d'ajouter votre email à la collection <code>admins</code>.
          </div>
          <button
            onClick={handleLogout}
            className="w-full py-3 bg-slate-200 text-slate-700 font-bold rounded-lg hover:bg-slate-300 transition"
          >
            Se déconnecter
          </button>
        </div>
      </div>
    );
  }

  // --- 3. Tableau de Bord (Pour les Admins Autorisés seulement) ---
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tableau de Bord</h1>
          <p className="text-slate-500 text-sm">Administrateur : <span className="font-semibold text-emerald-600">{user.email}</span></p>
        </div>
        <div className="flex gap-3">
           <button onClick={() => setShowSettings(true)} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
             <Settings size={16} /> Config
           </button>
           <button onClick={handleExportCSV} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
             <Download size={16} /> Export CSV
           </button>
           <button onClick={handleLogout} className="flex items-center gap-2 bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition">
             <LogOut size={16} /> Déconnexion
           </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                <Wallet size={24} />
            </div>
            <div>
              <p className="text-sm text-slate-500">Chiffre d'Affaires</p>
              <p className="text-2xl font-bold text-slate-900">{formatCurrency(stats.totalRevenue)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
                <CheckCircle size={24} />
            </div>
            <div>
              <p className="text-sm text-slate-500">Encaissé</p>
              <p className="text-2xl font-bold text-slate-900">{formatCurrency(stats.collected)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
                <Package size={24} />
            </div>
            <div>
              <p className="text-sm text-slate-500">Total Cartons</p>
              <div className="flex flex-col">
                 <span className="text-2xl font-bold text-slate-900">{stats.totalCartons}</span>
                 <span className="text-xs text-slate-400 font-medium">({stats.total24g}x 24g / {stats.total28g}x 28g)</span>
              </div>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
                <Truck size={24} />
            </div>
            <div>
              <p className="text-sm text-slate-500">À Livrer</p>
              <p className="text-2xl font-bold text-slate-900">{stats.pendingDelivery}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Table */}
      <div className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center">
            <Search className="text-slate-400 mr-2" size={20} />
            <input 
                type="text" 
                placeholder="Rechercher par nom ou licence..." 
                className="flex-1 outline-none text-slate-700 placeholder-slate-400"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 uppercase text-xs font-bold">
              <tr>
                <th className="px-6 py-3">Tireur</th>
                <th className="px-6 py-3 text-center">Quantité</th>
                <th className="px-6 py-3">Paiement</th>
                <th className="px-6 py-3 text-center">Statut</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrders.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500 italic">Aucune commande trouvée</td></tr>
              ) : (
                filteredOrders.map((order) => {
                  const totalPaid = order.transactions.reduce((sum, t) => sum + t.amount, 0);
                  const isFullyPaid = totalPaid >= order.totalAmount;
                  const progress = Math.min((totalPaid / order.totalAmount) * 100, 100);

                  return (
                    <tr key={order.id} className="hover:bg-slate-50 transition">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900">{order.lastName} {order.firstName}</div>
                        <div className="text-xs text-slate-500">{order.licenseNumber}</div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="font-medium text-slate-800">{order.qty24g + order.qty28g} Cartons</div>
                        <div className="text-xs text-slate-500">{order.qty24g}x 24g | {order.qty28g}x 28g</div>
                      </td>
                      <td className="px-6 py-4">
                         <div className="flex items-center justify-between mb-1">
                             <span className="font-bold text-slate-700">{formatCurrency(totalPaid)}</span>
                             <span className="text-xs text-slate-400">/ {formatCurrency(order.totalAmount)}</span>
                         </div>
                         <div className="w-full bg-slate-200 rounded-full h-1.5">
                            <div className={`h-1.5 rounded-full ${isFullyPaid ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{width: `${progress}%`}}></div>
                         </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {order.isDelivered ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                                Livré
                            </span>
                        ) : isFullyPaid ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                Prêt
                            </span>
                        ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                En attente
                            </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button 
                            onClick={() => setSelectedOrderForPayment(order)}
                            className="p-2 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition"
                            title="Gérer les paiements"
                        >
                            <Wallet size={18} />
                        </button>
                        <button 
                            onClick={() => toggleDelivery(order)}
                            disabled={!isFullyPaid}
                            className={`p-2 rounded transition ${
                                order.isDelivered 
                                ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' 
                                : isFullyPaid 
                                    ? 'bg-slate-100 text-slate-600 hover:bg-emerald-100 hover:text-emerald-700'
                                    : 'bg-slate-50 text-slate-300 cursor-not-allowed'
                            }`}
                            title={order.isDelivered ? "Annuler livraison" : "Marquer comme livré"}
                        >
                            <Truck size={18} />
                        </button>
                        <button 
                            onClick={() => setOrderToDelete(order)}
                            className="p-2 bg-red-50 text-red-500 hover:bg-red-100 rounded transition"
                            title="Supprimer définitivement"
                        >
                            <Trash2 size={18} /> 
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedOrderForPayment && (
          <TransactionHistoryDrawer 
            isOpen={!!selectedOrderForPayment}
            onClose={() => setSelectedOrderForPayment(null)}
            order={orders.find(o => o.id === selectedOrderForPayment.id) || selectedOrderForPayment}
            onAddTransaction={handleAddTransaction}
            onDeleteTransaction={handleDeleteTransaction}
          />
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowSettings(false)} />
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md relative z-10 p-6 animate-fade-in-up">
            <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Settings className="text-slate-700" /> Configuration Prix
            </h2>
            
            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Prix de vente (par carton)</label>
                <div className="relative">
                  <input
                    type="number"
                    value={editPricing.unitPrice}
                    onChange={(e) => setEditPricing({...editPricing, unitPrice: Number(e.target.value)})}
                    className="w-full p-3 border border-slate-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none"
                    required
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">€</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Acompte demandé (par carton)</label>
                <div className="relative">
                  <input
                    type="number"
                    value={editPricing.depositPerCarton}
                    onChange={(e) => setEditPricing({...editPricing, depositPerCarton: Number(e.target.value)})}
                    className="w-full p-3 border border-slate-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none"
                    required
                  />
                   <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">€</span>
                </div>
              </div>

              <div className="p-4 bg-amber-50 rounded-lg border border-amber-200 mt-2">
                <div className="flex items-start gap-3">
                   <div className="pt-1">
                      <input 
                        type="checkbox"
                        id="updateExisting"
                        checked={updateExistingOrders}
                        onChange={(e) => setUpdateExistingOrders(e.target.checked)}
                        className="w-5 h-5 text-amber-600 rounded focus:ring-amber-500"
                      />
                   </div>
                   <label htmlFor="updateExisting" className="text-sm text-amber-900 cursor-pointer">
                      <strong>Recalculer les commandes en cours ?</strong>
                      <p className="text-xs text-amber-700 mt-1">
                        Si coché, le "Total à payer" de toutes les commandes NON livrées sera mis à jour avec le nouveau prix ({editPricing.unitPrice}€).
                      </p>
                   </label>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowSettings(false)}
                  className="flex-1 py-3 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition shadow-lg"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {orderToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOrderToDelete(null)} />
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm relative z-10 p-6 animate-fade-in-up">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertTriangle className="text-red-600" size={24} />
                </div>
                <h3 className="text-lg font-bold text-center text-slate-900 mb-2">Supprimer la commande ?</h3>
                <p className="text-center text-slate-500 mb-6 text-sm">
                    Vous êtes sur le point de supprimer la commande de <strong>{orderToDelete.lastName} {orderToDelete.firstName}</strong>.<br/>
                    Cette action est irréversible.
                </p>
                <div className="flex gap-3">
                    <button 
                        onClick={() => setOrderToDelete(null)}
                        className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-lg hover:bg-slate-200 transition"
                    >
                        Annuler
                    </button>
                    <button 
                        onClick={() => {
                            onDeleteOrder(orderToDelete.id);
                            setOrderToDelete(null);
                        }}
                        className="flex-1 py-2.5 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition shadow-lg"
                    >
                        Supprimer
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};