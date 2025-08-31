-- Désactive les contraintes de clé étrangère temporairement
SET session_replication_role = 'replica';

-- Supprime toutes les tables dans l'ordre inverse de leur création
DROP TABLE IF EXISTS 
    loan_payments,
    transaction_attempts,
    notifications,
    loan_installments,
    transactions,
    loans,
    accounts,
    users,
    loan_products,
    scheduler_jobs CASCADE;

-- Réactive les contraintes
SET session_replication_role = 'origin';