import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth/auth.service';
import { LoanService } from '../../core/services/loan/loan.service';
import { LoanProduct } from '../../shared/models/loan.model';
import { animate, query, stagger, style, transition, trigger } from '@angular/animations';
import { LoanCalculatorComponent } from '../../shared/components/loan-calculator/loan-calculator.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, LoanCalculatorComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
  animations: [
    trigger('fadeInUp', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(20px)' }),
        animate('600ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ]),
    trigger('staggerIn', [
      transition('* => *', [
        query(':enter', [
          style({ opacity: 0, transform: 'translateY(20px)' }),
          stagger('100ms', [
            animate('500ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
          ])
        ], { optional: true })
      ])
    ])
  ]
})
export class HomeComponent implements OnInit {
  loanProducts: LoanProduct[] = [];
  testimonials = [
    {
      text: 'Leur équipe m\'a accompagné dans l\'achat de ma première maison avec un prêt très avantageux.',
      name: 'Sophie Martin',
      position: 'Artiste indépendante',
      avatar: 'assets/images/avatars/avatar1.jpg'
    },
    {
      text: 'Service client exceptionnel et plateforme en ligne très intuitive. Je recommande !',
      name: 'Thomas Lambert',
      position: 'Chef d\'entreprise',
      avatar: 'assets/images/avatars/avatar2.jpg'
    },
    {
      text: 'J\'ai obtenu un prêt pour développer mon commerce en moins de 48h. Incroyable !',
      name: 'Fatima Diallo',
      position: 'Commerçante',
      avatar: 'assets/images/avatars/avatar3.jpg'
    }
  ];

  constructor(
    public authService: AuthService,
    private loanService: LoanService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.loadLoanProducts();
  }

  loadLoanProducts() {
    this.loanService.getLoanProducts().subscribe({
      next: (products) => {
        this.loanProducts = products;
      },
      error: (err) => console.error('Erreur lors du chargement des produits de prêt :', err)
    });
  }

  getProductIcon(type: string): string {
    switch (type) {
      case 'personal': return 'bi bi-person';
      case 'mortgage': return 'bi bi-house';
      case 'business': return 'bi bi-briefcase';
      default: return 'bi bi-cash';
    }
  }

  requestLoan(product: LoanProduct) {
    this.router.navigate(['/loans/apply', product.id]);
  }

  // Section services statiques
  services = [
    {
      id: 'prets-personnels',
      icon: 'bi bi-cash-coin',
      title: 'Prêts personnels',
      description: 'Financement adapté à vos projets avec des taux compétitifs.',
    },
    {
      id: 'prets-immobiliers',
      icon: 'bi bi-house',
      title: 'Prêts immobiliers',
      description: 'Accédez à la propriété avec nos solutions de financement.',
    },
    {
      id: 'prets-PME',
      icon: 'bi bi-briefcase',
      title: 'Prêts PME',
      description: 'Soutenez le développement de votre petite ou moyenne entreprise avec nos solutions de financement adaptées.',
    },
    {
      id: 'comptes-epargne',
      icon: 'bi bi-piggy-bank',
      title: 'Comptes d\'épargne',
      description: 'Faites fructifier votre argent en toute sécurité.',
    },
    {
      id: 'banking-mobile',
      icon: 'bi bi-phone',
      title: 'Banking mobile',
      description: 'Gérez vos finances où que vous soyez.',
    }
  ];

  goToService(serviceId: string) {
    // Redirige vers le formulaire de prêt pour le service correspondant
    this.router.navigate(['/services', serviceId]);
  }
}
