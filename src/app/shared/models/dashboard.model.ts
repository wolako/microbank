export interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  avatar?: string;
  joinDate?: string;       // Date d'inscription
  lastLogin?: string;      // Dernière connexion
  accountNumber?: string;  // Numéro de compte bancaire
  kycVerified?: boolean;   // Vérification d'identité
  email_notifications_enabled?: boolean;
  sms_notifications_enabled?: boolean;
  role: 'user' | 'admin' | 'loan_officer' | 'support' | 'account_manager';
  is_verified: boolean;
  is_approved?: boolean;
  two_factor_enabled?: boolean;  // facultatif
  two_factor_secret?: string;
  two_factor_validated_at?: string
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  description: string;
  created_at: string;
  status: TransactionStatus;
  reference?: string;
  accountId?: string;
  balance_after?: number;
  channel?: string;
  metadata?: Record<string, any>;
}

// Types étendus pour plus de flexibilité
export type TransactionType = 
  | 'deposit_manual'
  | 'deposit_wire'
  | 'deposit_mobile'
  | 'deposit_card'
  | 'withdrawal'
  | 'transfer'
  | 'loan_payment'
  | 'loan_disbursement'
  | 'fee'
  | 'interest'
  | 'refund'
  | 'wire'
  | 'bill_payment'
  | 'purchase';

export interface CardInfo {
  number: string;
  exp: string;
  cvv: string;
}

export interface TransactionMetadata {
  phone?: string;
  provider?: string;
  card?: CardInfo;
  iban?: string;
  bankName?: string;
  merchant?: string;       
  product?: string;
  order_ref?: string;  
  [key: string]: any; 
}

export interface TransactionPayload {
  type: string;
  amount: number;
  recipient?: string;
  description?: string;
  metadata?: TransactionMetadata;
}

export type TransactionStatus = 
  | 'pending'             // En attente
  | 'completed'          // Terminé
  | 'failed'             // Échoué
  | 'reversed';          // Annulé/inversé

export interface PaginatedTransactions {
  data: Transaction[];   // Liste des transactions
  total: number;         // Nombre total de transactions
  page: number;          // Page actuelle
  pageSize: number;      // Nombre d'éléments par page
}