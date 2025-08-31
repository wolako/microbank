export interface BillPaymentRequest {
  billType: string;
  reference: string;
  billProvider: string;
  amount: number;
  accountNumber: string;
}
