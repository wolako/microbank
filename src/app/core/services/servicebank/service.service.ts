import { Injectable } from '@angular/core';

export interface BankService {
  id: string;
  title: string;
  description: string;
  image: string;
  benefits: string[];
  showLoanForm?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ServiceService {

  private services: BankService[] = [
    {
      id: 'prets-personnels',
      title: 'Prêts personnels',
      description: 'Nos prêts personnels vous aident à financer tous vos projets à court terme.',
      image: 'assets/images/personal-loan.jpg',
      benefits: [
        'Montants flexibles selon vos besoins',
        'Approbation rapide',
        'Taux avantageux'
      ],
      showLoanForm: true
    },
    {
      id: 'prets-immobiliers',
      title: 'Prêts immobiliers',
      description: 'Réalisez votre rêve de devenir propriétaire avec un prêt adapté.',
      image: 'assets/images/real-estate.jpg',
      benefits: [
        'Financement jusqu’à 90% du bien',
        'Durée jusqu’à 25 ans',
        'Conseils personnalisés'
      ],
      showLoanForm: true
    },
    {
      id: 'prets-PME',
      title: 'Prêts PME',
      description: 'Soutenez le développement de votre petite ou moyenne entreprise avec nos solutions de financement adaptées.',
      image: 'assets/images/business-loan.jpg',
      benefits: [
        'Financement pour équipements et infrastructures',
        'Conditions flexibles selon le projet',
        'Accompagnement personnalisé'
      ],
      showLoanForm: true
    },
    {
      id: 'comptes-epargne',
      title: 'Compte épargne',
      description: 'Faites fructifier vos revenus en toute sécurité.',
      image: 'assets/images/savings.jpg',
      benefits: [
        'Taux d’intérêt compétitif',
        'Accès à vos fonds à tout moment',
        'Aucune commission d’ouverture'
      ],
      showLoanForm: false
    },
    {
      id: 'banking-mobile',
      title: 'Banking mobile',
      description: 'Accédez à vos comptes 24/7 depuis votre téléphone.',
      image: 'assets/images/mobile-banking.jpg',
      benefits: [
        'Sécurisé et rapide',
        'Paiement de factures',
        'Consultation de solde en temps réel'
      ],
      showLoanForm: false
    }
  ];

  getServiceById(id: string): BankService | undefined {
    return this.services.find(s => s.id === id);
  }

  getAllServices(): BankService[] {
    return this.services;
  }
}
