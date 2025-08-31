export interface LoanProduct {
  id: string;
  name: string;
  type: 'personal' | 'mortgage' | 'business';
  description: string;
  interestRate: number;
  minAmount: number;
  maxAmount: number;
  minTerm: number;
  maxTerm: number;
  features: string[];
}

export interface LoanCalculation {
  amount: number;
  term: number;
  monthlyPayment: number;
  totalInterest: number;
  totalPayment: number;
}

export interface Installment {
  dueDate: string;        // Date d’échéance
  amount: number;         // Montant à payer
  status: 'upcoming' | 'paid' | 'overdue'; // Statut de l’échéance
  loanId: string;         // ID du prêt lié
}

export interface Loan {
  id: string;
  amount: number;
  interestRate: number;
  termMonths: number;
  monthlyPayment: number;
  status: 'pending' | 'approved' | 'active' | 'rejected' | 'cancelled' | 'completed';
  startDate?: string;
  endDate?: string;
  createdAt?: string;
  nextPayment?: {
    dueDate: string;
    amount: number;
  };
  paymentsCount?: number;
}

export interface LoanStats {
  user_id: string;
  active_loans: number;
  completed_loans: number;
  total_borrowed: number;
  total_interest_paid: number;
  unpaid_installments: number;
  next_payment_date: string | null;
  next_payment_amount: number | null;
  overdue_loans: number;
  current_loan_id: string | null;
  creditScore: number;
}

