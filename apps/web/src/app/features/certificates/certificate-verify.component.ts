import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';
import {
  Certificate,
  EnrollmentsService,
} from '../../core/services/enrollments.service';

/**
 * Public page for a certificate, e.g. technyks.com/certificate/TA-7K2M-9QXD-4HPW.
 * The QR code on the PDF opens it, so employers can confirm a certificate
 * is genuine. Students use it to download, copy the link or add to LinkedIn.
 */
@Component({
  selector: 'app-certificate-verify',
  standalone: true,
  imports: [CommonModule, RouterModule],
  styles: [
    `
      /* Sizes use container width (cqw) so the preview scales like the PDF. */
      .frame {
        container-type: inline-size;
      }
      .paper {
        position: relative;
        aspect-ratio: 842 / 595;
        background: #fffdf7;
        border: 1.7cqw solid #0b1f4d;
        color: #1f2937;
        text-align: center;
        font-family: Arial, Helvetica, sans-serif;
        overflow: hidden;
      }
      .paper::after {
        content: '';
        position: absolute;
        inset: 1.2cqw;
        border: 0.18cqw solid #b8892b;
        pointer-events: none;
      }
      .serif { font-family: 'Times New Roman', Georgia, serif; }
      .gold { color: #b8892b; }
      .navy { color: #0b1f4d; }
      .muted { color: #6b7280; }
      .brand { display: flex; align-items: center; justify-content: center; gap: 1.2cqw; padding-top: 4.6cqw; }
      .mark { width: 3.6cqw; height: 3.6cqw; border-radius: 0.8cqw; background: #1d4ed8; color: #fff; font-weight: 700; font-size: 2.1cqw; display: flex; align-items: center; justify-content: center; }
      .brand-name { font-size: 1.55cqw; font-weight: 700; letter-spacing: 0.45cqw; }
      .title { font-size: 4.75cqw; font-weight: 700; letter-spacing: 0.7cqw; margin-top: 2cqw; line-height: 1.1; }
      .subtitle { font-size: 1.55cqw; font-weight: 700; letter-spacing: 0.85cqw; margin-top: 0.4cqw; }
      .text { font-size: 1.45cqw; }
      .name { font-size: 4.3cqw; font-weight: 700; font-style: italic; line-height: 1.2; margin: 0.6cqw 8cqw 0; }
      .rule { height: 0.1cqw; background: #b8892b; width: 50cqw; margin: 0.4cqw auto 1.4cqw; }
      .course { font-size: 2.85cqw; font-weight: 700; line-height: 1.2; margin: 0.6cqw 13cqw 0; }
      .facts { font-size: 1.25cqw; margin-top: 0.7cqw; }
      .footer { position: absolute; left: 11cqw; right: 11cqw; bottom: 9.5cqw; display: flex; align-items: flex-end; justify-content: space-between; }
      .footer-col { width: 22.5cqw; }
      .footer-value { font-size: 1.7cqw; font-weight: 700; }
      .footer-sign { font-size: 2.4cqw; font-style: italic; }
      .footer-line { height: 0.1cqw; background: #1f2937; margin-top: 0.6cqw; }
      .footer-label { font-size: 1.07cqw; letter-spacing: 0.18cqw; margin-top: 0.8cqw; }
      .seal { font-size: 9cqw; line-height: 1; }
    `,
  ],
  template: `
    <div class="px-4 sm:px-6 md:px-16 pt-24 pb-20 max-w-6xl mx-auto">
      @if (loading()) {
        <p class="font-['JetBrains_Mono'] text-sm text-slate-500 dark:text-slate-400" role="status">Checking certificate…</p>
      } @else if (!certificate()) {
        <div class="mx-auto max-w-lg rounded-xl border border-slate-200 bg-white p-8 text-center dark:border-white/10 dark:bg-[#121A2B]">
          <span class="material-symbols-outlined text-5xl !text-rose-500">gpp_bad</span>
          <h1 class="mt-3 text-2xl font-bold text-slate-950 dark:text-white">Certificate not found</h1>
          <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">
            No Technyks Academy certificate has the ID
            <strong class="font-['JetBrains_Mono']">{{ number() }}</strong>. Check the ID and try again.
          </p>
          <a routerLink="/courses" class="mt-6 inline-block rounded !bg-[#2563EB] px-5 py-2.5 text-sm font-bold !text-white">Browse courses</a>
        </div>
      } @else {
        @let cert = certificate()!;
        <div class="mb-6 flex flex-wrap items-center gap-3">
          <span class="inline-flex items-center gap-1.5 rounded-full !bg-emerald-100 px-3 py-1.5 font-['JetBrains_Mono'] text-xs font-bold !text-emerald-800">
            <span class="material-symbols-outlined text-base">verified</span> Verified certificate
          </span>
          <span class="font-['JetBrains_Mono'] text-xs text-slate-500 dark:text-slate-400">ID {{ cert.certificateNumber }}</span>
        </div>

        <div class="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
          <!-- Certificate preview -->
          <div class="frame w-full shadow-xl">
            <div class="paper" aria-label="Certificate preview">
              <div class="brand">
                <span class="mark">T</span>
                <span class="brand-name navy">TECHNYKS ACADEMY</span>
              </div>
              <p class="serif navy title">CERTIFICATE</p>
              <p class="gold subtitle">OF COMPLETION</p>
              <p class="muted text" style="margin-top:2.2cqw">This is to certify that</p>
              <p class="serif name">{{ cert.studentName }}</p>
              <div class="rule"></div>
              <p class="muted text">has successfully completed the online course</p>
              <p class="serif navy course">{{ cert.courseTitle }}</p>
              @if (facts(cert)) {
                <p class="muted facts">{{ facts(cert) }}</p>
              }
              <div class="footer">
                <div class="footer-col">
                  <p class="serif footer-value">{{ cert.issuedAt | date: 'd MMMM y' }}</p>
                  <div class="footer-line"></div>
                  <p class="muted footer-label">DATE OF COMPLETION</p>
                </div>
                <span class="material-symbols-outlined gold seal" aria-hidden="true">workspace_premium</span>
                <div class="footer-col">
                  <p class="serif footer-sign">Technyks Academy</p>
                  <div class="footer-line"></div>
                  <p class="muted footer-label">AUTHORIZED SIGNATORY</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Details and actions -->
          <aside class="flex flex-col gap-5 rounded-xl border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-[#121A2B]">
            <div>
              <p class="font-['JetBrains_Mono'] text-[10px] font-bold uppercase tracking-[.2em] text-blue-600">Awarded to</p>
              <p class="mt-1 text-lg font-bold text-slate-950 dark:text-white">{{ cert.studentName }}</p>
            </div>
            <div>
              <p class="font-['JetBrains_Mono'] text-[10px] font-bold uppercase tracking-[.2em] text-blue-600">Course</p>
              @if (cert.courseSlug) {
                <a [routerLink]="['/courses', cert.courseSlug]" class="mt-1 block font-bold text-slate-950 hover:text-blue-600 dark:text-white">{{ cert.courseTitle }}</a>
              } @else {
                <p class="mt-1 font-bold text-slate-950 dark:text-white">{{ cert.courseTitle }}</p>
              }
              @if (facts(cert)) {
                <p class="text-sm text-slate-600 dark:text-slate-300">{{ facts(cert) }}</p>
              }
            </div>
            <div>
              <p class="font-['JetBrains_Mono'] text-[10px] font-bold uppercase tracking-[.2em] text-blue-600">Completed on</p>
              <p class="mt-1 text-slate-950 dark:text-white">{{ cert.issuedAt | date: 'd MMMM y' }}</p>
            </div>

            <div class="flex flex-col gap-2 border-t border-slate-200 pt-5 dark:border-white/10">
              <a [href]="cert.downloadUrl" class="inline-flex items-center justify-center gap-1.5 rounded !bg-[#2563EB] px-4 py-2.5 text-sm font-bold !text-white hover:!bg-[#1D4ED8]">
                <span class="material-symbols-outlined text-base">download</span> Download PDF
              </a>
              <a [href]="linkedInUrl(cert)" target="_blank" rel="noopener" class="inline-flex items-center justify-center gap-1.5 rounded !bg-[#0A66C2] px-4 py-2.5 text-sm font-bold !text-white hover:!bg-[#004182]">
                <span class="material-symbols-outlined text-base">work</span> Add to LinkedIn
              </a>
              <button type="button" (click)="copyLink(cert)" class="inline-flex items-center justify-center gap-1.5 rounded border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:border-blue-500 dark:border-white/20 dark:text-slate-200">
                <span class="material-symbols-outlined text-base">{{ copied() ? 'check' : 'link' }}</span>
                {{ copied() ? 'Link copied' : 'Copy share link' }}
              </button>
            </div>
          </aside>
        </div>
      }
    </div>
  `,
})
export class CertificateVerifyComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly enrollments = inject(EnrollmentsService);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);

  readonly number = signal('');
  readonly certificate = signal<Certificate | null>(null);
  readonly loading = signal(true);
  readonly copied = signal(false);

  ngOnInit() {
    this.route.paramMap.subscribe((params) => {
      const number = String(params.get('number') || '').toUpperCase();
      this.number.set(number);
      this.loading.set(true);
      this.enrollments.verifyCertificate(number).subscribe({
        next: (certificate) => {
          this.certificate.set(certificate);
          this.loading.set(false);
          this.title.setTitle(`${certificate.studentName} – ${certificate.courseTitle} | Technyks Academy certificate`);
          this.meta.updateTag({
            name: 'description',
            content: `${certificate.studentName} completed ${certificate.courseTitle} at Technyks Academy. Certificate ID ${certificate.certificateNumber}.`,
          });
        },
        error: () => {
          this.certificate.set(null);
          this.loading.set(false);
          this.title.setTitle('Certificate not found | Technyks Academy');
        },
      });
    });
  }

  facts(cert: Certificate): string {
    return [
      cert.lessonCount ? `${cert.lessonCount} lessons` : '',
      cert.courseLength ? `${cert.courseLength} of video` : '',
    ]
      .filter(Boolean)
      .join(' · ');
  }

  /** LinkedIn's "Add licence or certification" form, pre-filled. */
  linkedInUrl(cert: Certificate): string {
    const issued = new Date(cert.issuedAt);
    const params = new URLSearchParams({
      startTask: 'CERTIFICATION_NAME',
      name: cert.courseTitle,
      organizationName: 'Technyks Academy',
      issueYear: String(issued.getFullYear()),
      issueMonth: String(issued.getMonth() + 1),
      certUrl: cert.verifyUrl,
      certId: cert.certificateNumber,
    });
    return `https://www.linkedin.com/profile/add?${params.toString()}`;
  }

  async copyLink(cert: Certificate) {
    try {
      await navigator.clipboard.writeText(cert.verifyUrl);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2500);
    } catch {
      window.prompt('Copy this link:', cert.verifyUrl);
    }
  }
}
