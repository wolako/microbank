import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './about.component.html',
  styleUrl: './about.component.scss'
})
export class AboutComponent {
  teamMembers = [
    {
      name: 'Jean Dupont',
      role: 'Fondateur & CEO',
      bio: 'Expert en finance avec 15 ans d\'expérience dans le secteur bancaire.',
      // avatar: 'assets/images/team/jean-dupont.jpg'
    },
    {
      name: 'Marie Martin',
      role: 'Directrice des Opérations',
      bio: 'Spécialiste en microcrédit et inclusion financière.',
      // avatar: 'assets/images/team/marie-martin.jpg'
    },
    {
      name: 'Thomas Leroy',
      role: 'Responsable Technologie',
      bio: 'Développeur full-stack passionné par les fintech.',
      // avatar: 'assets/images/team/thomas-leroy.jpg'
    }
  ];

  milestones = [
    {
      year: '2015',
      title: 'Fondation',
      description: 'Création de MicroFinance avec une vision d\'inclusion financière.'
    },
    {
      year: '2018',
      title: 'Premier partenariat',
      description: 'Collaboration avec des institutions locales pour étendre notre portée.'
    },
    {
      year: '2020',
      title: 'Plateforme digitale',
      description: 'Lancement de notre application mobile pour un meilleur accès.'
    },
    {
      year: '2023',
      title: 'Expansion régionale',
      description: 'Ouverture de 3 nouvelles agences dans la région.'
    }
  ];
}
