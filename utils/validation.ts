export const isValidLicense = (license: string): boolean => {
  // Format accepté : 8 à 15 caractères (Chiffres, Lettres majuscules ou tirets)
  // Cela couvre le nouveau format (13 chiffres) et l'ancien (8 chiffres ou XX-00000000)
  const regex = /^[A-Z0-9-]{8,15}$/;
  return regex.test(license);
};

export const isValidPhone = (phone: string): boolean => {
  // 10 digits starting with 06 or 07
  const regex = /^(06|07)\d{8}$/;
  return regex.test(phone);
};

export const isValidEmail = (email: string): boolean => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
};

export const formatDate = (dateString: string): string => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const formatShortDate = (dateString: string): string => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('fr-FR');
};