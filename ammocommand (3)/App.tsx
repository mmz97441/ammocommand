import React, { useState, useEffect } from 'react';
import { ToastProvider, useToast } from './components/ui/Toast';
import { ShooterSpace } from './components/ShooterSpace';
import { AdminSpace } from './components/AdminSpace';
import { Order, PricingConfig, DEFAULT_PRICES } from './types';
import { Shield, Target, Loader2 } from 'lucide-react';

// Firebase Imports
import { db, auth } from './firebaseConfig';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, orderBy, setDoc, getDoc, writeBatch } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';

const AppContent: React.FC = () => {
  const [view, setView] = useState<'shooter' | 'admin'>('shooter');
  const [orders, setOrders] = useState<Order[]>([]);
  const [pricing, setPricing] = useState<PricingConfig>(DEFAULT_PRICES);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  const { addToast } = useToast();

  // -- REAL-TIME DATABASE LISTENER --
  useEffect(() => {
    // 0. Auth Listener Global
    const authUnsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });

    // 1. Charger les configurations de prix
    const fetchSettings = async () => {
      try {
        const settingsRef = doc(db, 'settings', 'global');
        const settingsSnap = await getDoc(settingsRef);
        
        if (settingsSnap.exists()) {
          setPricing(settingsSnap.data() as PricingConfig);
        } else {
          // Initialiser avec les défauts si n'existe pas
          await setDoc(settingsRef, DEFAULT_PRICES);
        }
      } catch (e) {
        console.error("Erreur chargement settings", e);
      }
    };
    
    fetchSettings();

    // 2. Écouter la collection "orders" en temps réel
    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Order[];
      
      setOrders(ordersData);
      setLoading(false);
    }, (error) => {
      console.error("Erreur Firestore:", error);
      addToast("Erreur de connexion à la base de données", "error");
      setLoading(false);
    });

    // Nettoyage à la fermeture du composant
    return () => {
      unsubscribe();
      authUnsub();
    };
  }, [addToast]);

  // -- ACTIONS --

  const handleOrderSubmit = async (orderData: Omit<Order, 'id' | 'createdAt' | 'transactions' | 'isDelivered'>) => {
    try {
      const newOrderData = {
        ...orderData,
        createdAt: new Date().toISOString(),
        userId: currentUser?.uid || null, // Liaison avec le compte utilisateur
        transactions: [],
        isDelivered: false
      };
      
      await addDoc(collection(db, "orders"), newOrderData);
      
      addToast('Commande enregistrée et synchronisée !', 'success');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      console.error(e);
      addToast("Erreur lors de l'enregistrement", "error");
    }
  };

  const handleUpdateOrder = async (updatedOrder: Order) => {
    try {
      const orderRef = doc(db, "orders", updatedOrder.id);
      const { id, ...dataToUpdate } = updatedOrder; 
      await updateDoc(orderRef, dataToUpdate);
    } catch (e) {
      console.error(e);
      addToast("Erreur de mise à jour", "error");
    }
  };

  const handleDeleteOrder = async (id: string) => {
    try {
      await deleteDoc(doc(db, "orders", id));
      addToast("Commande supprimée définitivement", "info");
    } catch (e) {
      console.error(e);
      addToast("Impossible de supprimer", "error");
    }
  };

  const handleUpdatePricing = async (newConfig: PricingConfig, updateExistingOrders: boolean) => {
    try {
      setLoading(true);
      // 1. Mettre à jour les settings globaux
      await setDoc(doc(db, 'settings', 'global'), newConfig);
      setPricing(newConfig);

      // 2. Si demandé, recalculer toutes les commandes non livrées
      if (updateExistingOrders) {
        const batch = writeBatch(db);
        let updatedCount = 0;

        orders.forEach((order) => {
          if (!order.isDelivered) {
            const newTotal = (order.qty24g + order.qty28g) * newConfig.unitPrice;
            const newDeposit = (order.qty24g + order.qty28g) * newConfig.depositPerCarton;
            
            // On ne met à jour que si le montant change
            if (newTotal !== order.totalAmount || newDeposit !== order.depositRequired) {
              const orderRef = doc(db, "orders", order.id);
              batch.update(orderRef, { 
                totalAmount: newTotal,
                depositRequired: newDeposit
              });
              updatedCount++;
            }
          }
        });

        if (updatedCount > 0) {
          await batch.commit();
          addToast(`${updatedCount} commandes recalculées avec le nouveau prix`, 'success');
        } else {
          addToast('Prix mis à jour (aucune commande à recalculer)', 'success');
        }
      } else {
        addToast('Paramètres de prix mis à jour pour les futures commandes', 'success');
      }
    } catch (e) {
      console.error(e);
      addToast("Erreur lors de la mise à jour des prix", "error");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 gap-2">
        <Loader2 className="animate-spin" /> Chargement des données...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      
      {/* Navigation Bar */}
      <nav className="bg-slate-900 text-white shadow-lg sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2 font-bold text-lg tracking-wide">
              <div className="w-8 h-8 bg-emerald-600 rounded flex items-center justify-center">
                <Target size={20} className="text-white" />
              </div>
              <span>AMMO<span className="text-emerald-500">COMMAND</span></span>
            </div>
            
            <div className="flex gap-2 bg-slate-800 p-1 rounded-lg">
              <button
                onClick={() => setView('shooter')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                  view === 'shooter' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                Espace Tireur
              </button>
              <button
                onClick={() => setView('admin')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition flex items-center gap-2 ${
                  view === 'admin' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Shield size={14} /> Admin
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-grow">
        {view === 'shooter' ? (
          <ShooterSpace 
            orders={orders} 
            onOrderSubmit={handleOrderSubmit} 
            pricing={pricing}
            currentUser={currentUser}
          />
        ) : (
          <AdminSpace 
            orders={orders} 
            onLogout={() => setView('shooter')}
            onUpdateOrder={handleUpdateOrder}
            onDeleteOrder={handleDeleteOrder}
            pricing={pricing}
            onUpdatePricing={handleUpdatePricing}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-slate-100 border-t border-slate-200 py-6 mt-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-slate-500 text-sm">
          <p>© 2024 AmmoCommand v2.3 - Gestion Simplifiée de Commandes</p>
          <p className="mt-1 text-xs">Propulsé par Firebase Cloud</p>
        </div>
      </footer>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
};

export default App;