import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { UserDocument } from '../../../shared/models/document.model';


@Injectable({
  providedIn: 'root'
})
export class DocumentsService {
  private apiUrl = 'http://localhost:3000/api/documents';

  constructor(private http: HttpClient) {}

  // Lister les documents
  getDocuments(): Observable<UserDocument[]> {
    return this.http.get<UserDocument[]>(this.apiUrl);
  }

  // Ajouter un document
  uploadDocument(formData: FormData): Observable<UserDocument> {
    return this.http.post<UserDocument>(this.apiUrl, formData);
  }


  // Supprimer un document
  deleteDocument(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
  }

  // Télécharger un document
  downloadDocument(id: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/${id}/download`, { responseType: 'blob' });
  }

}
