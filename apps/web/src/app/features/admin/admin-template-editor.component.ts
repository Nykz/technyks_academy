import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import {
  AdminUiTemplate,
  TemplatesService,
} from '../../core/services/templates.service';
import { MediaUrlPipe } from '../../core/pipes/media-url.pipe';

type Editor = Partial<AdminUiTemplate> & { tagsText: string };
type EditorSection = 'product' | 'media' | 'delivery' | 'settings';

@Component({
  selector: 'app-admin-template-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, MediaUrlPipe],
  template: `
    <div
      class="min-h-screen bg-slate-100 text-slate-950 dark:bg-[#040810] dark:text-white"
    >
      @if (feedback()) {
        <div
          class="admin-toast admin-toast-success"
          role="status"
          aria-live="polite"
        >
          <span class="material-symbols-outlined">check_circle</span>
          <div>
            <strong>Saved successfully</strong><span>{{ feedback() }}</span>
          </div>
        </div>
      }
      @if (error()) {
        <div class="admin-toast admin-toast-error" role="alert">
          <span class="material-symbols-outlined">error</span>
          <div>
            <strong>Action required</strong><span>{{ error() }}</span>
          </div>
        </div>
      }

      <header
        class="border-b border-slate-200 bg-white px-4 py-4 shadow-sm dark:border-white/10 dark:bg-[#121A2B] sm:px-6"
      >
        <div
          class="mx-auto flex max-w-7xl flex-col justify-between gap-4 lg:flex-row lg:items-center"
        >
          <div class="min-w-0">
            <a
              routerLink="/admin"
              [queryParams]="{ tab: 'templates' }"
              class="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-blue-700 dark:text-slate-300 dark:hover:text-blue-400"
              ><span class="material-symbols-outlined text-base"
                >arrow_back</span
              >Back to UI Templates</a
            >
            <div class="mt-2 flex min-w-0 flex-wrap items-center gap-3">
              <h1 class="max-w-2xl truncate text-xl font-bold sm:text-2xl">
                {{
                  editor.title ||
                    (isNew() ? 'Create UI template' : 'Loading product…')
                }}
              </h1>
              <span
                class="rounded-full px-2.5 py-1 text-[9px] font-bold uppercase"
                [class.bg-emerald-100]="editor.isPublished"
                [class.text-emerald-800]="editor.isPublished"
                [class.bg-amber-100]="!editor.isPublished"
                [class.text-amber-800]="!editor.isPublished"
                >{{ editor.isPublished ? 'Published' : 'Draft' }}</span
              >
            </div>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            @if (!isNew() && editor.slug) {
              <a
                [routerLink]="['/templates', editor.slug]"
                target="_blank"
                class="inline-flex items-center gap-1 rounded-xl border border-slate-300 px-4 py-2.5 text-xs font-bold text-slate-700 hover:border-blue-500 hover:text-blue-700 dark:border-slate-700 dark:text-slate-200"
                >Student preview<span
                  class="material-symbols-outlined text-base"
                  >open_in_new</span
                ></a
              >
            }
            @if (!isNew()) {
              <button
                type="button"
                (click)="remove()"
                class="rounded-xl border border-red-200 px-4 py-2.5 text-xs font-bold text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/30"
              >
                Delete
              </button>
            }
            <button
              type="submit"
              form="product-editor-form"
              [disabled]="busy() || loading()"
              class="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 font-['JetBrains_Mono'] text-xs font-bold uppercase !text-white shadow-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <span
                class="material-symbols-outlined text-lg"
                [class.animate-spin]="busy()"
                >{{ busy() ? 'progress_activity' : 'save' }}</span
              >{{
                busy() ? 'Saving…' : isNew() ? 'Create product' : 'Save changes'
              }}
            </button>
          </div>
        </div>
      </header>

      @if (loading()) {
        <div class="mx-auto max-w-7xl p-8">
          <div
            class="h-96 animate-pulse rounded-2xl bg-white dark:bg-[#121A2B]"
          ></div>
        </div>
      } @else {
        <form
          id="product-editor-form"
          #productForm="ngForm"
          (ngSubmit)="save(productForm)"
          class="mx-auto grid max-w-7xl items-start gap-6 px-4 py-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:px-8 lg:py-8"
          autocomplete="off"
        >
          <aside
            class="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-[#121A2B] lg:sticky lg:top-4"
          >
            <p
              class="px-3 py-2 font-['JetBrains_Mono'] text-[10px] font-bold uppercase tracking-widest text-slate-400"
            >
              Product editor
            </p>
            <nav
              class="grid gap-1 sm:grid-cols-4 lg:grid-cols-1"
              aria-label="Product editor sections"
            >
              <button
                type="button"
                (click)="section.set('product')"
                [class.editor-nav-active]="section() === 'product'"
                class="editor-nav"
              >
                <span class="material-symbols-outlined">inventory_2</span
                ><span>Product</span>
              </button>
              <button
                type="button"
                (click)="section.set('media')"
                [class.editor-nav-active]="section() === 'media'"
                class="editor-nav"
              >
                <span class="material-symbols-outlined">perm_media</span
                ><span>Media</span>
              </button>
              <button
                type="button"
                (click)="section.set('delivery')"
                [class.editor-nav-active]="section() === 'delivery'"
                class="editor-nav"
              >
                <span class="material-symbols-outlined">cloud_download</span
                ><span>Delivery</span>
              </button>
              <button
                type="button"
                (click)="section.set('settings')"
                [class.editor-nav-active]="section() === 'settings'"
                class="editor-nav"
              >
                <span class="material-symbols-outlined">tune</span
                ><span>Settings</span>
              </button>
            </nav>
            @if (!isNew()) {
              <div
                class="mt-4 border-t border-slate-200 px-3 pt-4 text-xs text-slate-500 dark:border-white/10"
              >
                <strong class="block text-slate-700 dark:text-slate-200"
                  >Last saved</strong
                ><span class="mt-1 block">{{
                  formatDate(selected()?.updatedAt)
                }}</span>
              </div>
            }
          </aside>

          <main
            class="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#121A2B]"
          >
            @if (section() === 'product') {
              <section class="editor-section">
                <div class="section-heading">
                  <span class="material-symbols-outlined">sell</span>
                  <div>
                    <h2>Product information</h2>
                    <p>
                      What customers see on the storefront and product page.
                    </p>
                  </div>
                </div>
                <div class="mt-6 grid gap-5 md:grid-cols-2">
                  <label class="block"
                    ><span class="field-label">Product title *</span
                    ><input
                      required
                      minlength="3"
                      maxlength="191"
                      [(ngModel)]="editor.title"
                      name="title"
                      class="admin-field"
                  /></label>
                  <label class="block"
                    ><span class="field-label">Store URL slug</span>
                    <div class="slug-field">
                      <span>templates/</span
                      ><input
                        [(ngModel)]="editor.slug"
                        name="slug"
                        placeholder="generated-from-title"
                      /></div
                  ></label>
                  <label class="block md:col-span-2"
                    ><span class="field-label">Short sales description *</span
                    ><input
                      required
                      minlength="5"
                      maxlength="300"
                      [(ngModel)]="editor.tagline"
                      name="tagline"
                      class="admin-field"
                  /></label>
                  <label class="block md:col-span-2"
                    ><span class="field-label">Full product description *</span
                    ><textarea
                      required
                      minlength="20"
                      maxlength="20000"
                      rows="9"
                      [(ngModel)]="editor.description"
                      name="description"
                      class="admin-field"
                    ></textarea
                    ><small class="field-help"
                      >Explain what is included, compatibility, requirements and
                      ideal use cases.</small
                    ></label
                  >
                  <label class="block"
                    ><span class="field-label">Category</span
                    ><input
                      [(ngModel)]="editor.category"
                      name="category"
                      placeholder="Dashboard"
                      class="admin-field"
                  /></label>
                  <label class="block"
                    ><span class="field-label">Tags</span
                    ><input
                      [(ngModel)]="editor.tagsText"
                      name="tags"
                      placeholder="Angular, Tailwind, SaaS"
                      class="admin-field"
                    /><small class="field-help"
                      >Separate tags with commas.</small
                    ></label
                  >
                  <label class="block"
                    ><span class="field-label">Price</span
                    ><input
                      type="number"
                      min="0"
                      max="10000000"
                      [(ngModel)]="editor.price"
                      name="price"
                      class="admin-field"
                  /></label>
                  <label class="block"
                    ><span class="field-label">Currency</span
                    ><select
                      [(ngModel)]="editor.currency"
                      name="currency"
                      class="admin-field"
                    >
                      <option value="INR">INR — Indian Rupee</option>
                      <option value="USD">USD — US Dollar</option>
                    </select></label
                  >
                </div>
              </section>
            }

            @if (section() === 'media') {
              <div class="divide-y divide-slate-200 dark:divide-white/10">
                <section class="editor-section">
                  <div class="section-heading">
                    <span class="material-symbols-outlined">image</span>
                    <div>
                      <h2>Product thumbnail</h2>
                      <p>
                        Upload a consistent storefront cover or paste an
                        existing image address.
                      </p>
                    </div>
                  </div>
                  <div
                    class="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(260px,.85fr)]"
                  >
                    <div
                      class="relative aspect-video overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-[#080D18]"
                    >
                      @if (editor.thumbnail) {
                        <img
                          [src]="editor.thumbnail | mediaUrl"
                          alt="Product thumbnail preview"
                          class="h-full w-full object-cover"
                        />
                      } @else {
                        <div
                          class="grid h-full place-items-center text-center text-slate-400"
                        >
                          <div>
                            <span class="material-symbols-outlined text-5xl"
                              >add_photo_alternate</span
                            >
                            <p class="mt-2 text-sm">No thumbnail uploaded</p>
                          </div>
                        </div>
                      }
                      @if (uploadingImage()) {
                        <div
                          class="absolute inset-0 grid place-items-center bg-slate-950/80 text-white"
                        >
                          <div class="text-center">
                            <span
                              class="material-symbols-outlined animate-spin text-4xl text-blue-400"
                              >progress_activity</span
                            >
                            <p class="mt-2 text-xs font-bold">
                              Uploading thumbnail…
                            </p>
                          </div>
                        </div>
                      }
                    </div>
                    <div
                      class="flex flex-col justify-between gap-5 rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-[#080D18]"
                    >
                      <div>
                        <h3 class="font-bold">Thumbnail guidelines</h3>
                        <p
                          class="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300"
                        >
                          Use a clean 16:9 JPG, PNG, WebP or GIF up to 10 MB.
                          Recommended size: 1600 × 900 px.
                        </p>
                      </div>
                      <div class="space-y-3">
                        <label
                          [class.pointer-events-none]="uploadingImage()"
                          class="block cursor-pointer rounded-xl bg-blue-600 px-4 py-3 text-center font-['JetBrains_Mono'] text-xs font-bold uppercase !text-white hover:bg-blue-700"
                          >{{
                            editor.thumbnail
                              ? 'Replace thumbnail'
                              : 'Upload thumbnail'
                          }}<input
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/gif"
                            class="hidden"
                            (change)="handleThumbnailFile($event)"
                        /></label>
                        @if (editor.thumbnail) {
                          <button
                            type="button"
                            (click)="removeMedia('thumbnail')"
                            [disabled]="removingMedia() === 'thumbnail'"
                            class="w-full rounded-xl border border-red-200 px-4 py-3 text-xs font-bold text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300"
                          >
                            {{
                              removingMedia() === 'thumbnail'
                                ? 'Removing…'
                                : 'Remove thumbnail'
                            }}
                          </button>
                        }
                      </div>
                    </div>
                  </div>
                  <label class="mt-5 block"
                    ><span class="field-label">Thumbnail URL</span
                    ><input
                      type="text"
                      [(ngModel)]="editor.thumbnail"
                      name="thumbnail"
                      placeholder="https://cdn.example.com/cover.jpg"
                      class="admin-field"
                    /><small class="field-help"
                      >You can use an HTTPS URL instead of uploading a
                      file.</small
                    ></label
                  >
                </section>

                <section class="editor-section">
                  <div class="section-heading">
                    <span class="material-symbols-outlined">smart_display</span>
                    <div>
                      <h2>Promotional video</h2>
                      <p>
                        Upload a product demonstration or paste a YouTube, Vimeo
                        or direct HTTPS video link.
                      </p>
                    </div>
                  </div>
                  <div
                    class="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(260px,.85fr)]"
                  >
                    <div
                      class="relative aspect-video overflow-hidden rounded-2xl border border-slate-200 bg-black dark:border-slate-700"
                    >
                      @if (isDirectVideo(editor.promoVideoUrl)) {
                        <video
                          [src]="editor.promoVideoUrl | mediaUrl"
                          controls
                          class="h-full w-full object-contain"
                        ></video>
                      } @else if (promoEmbedUrl()) {
                        <iframe
                          [src]="promoEmbedUrl()"
                          title="Product promotional video preview"
                          class="h-full w-full border-0"
                          allow="autoplay; encrypted-media; picture-in-picture"
                          referrerpolicy="strict-origin-when-cross-origin"
                          allowfullscreen
                        ></iframe>
                      } @else {
                        <div
                          class="grid h-full place-items-center text-center text-slate-400"
                        >
                          <div>
                            <span class="material-symbols-outlined text-5xl"
                              >smart_display</span
                            >
                            <p class="mt-2 text-sm">No promotional video</p>
                          </div>
                        </div>
                      }
                      @if (uploadingVideo()) {
                        <div
                          class="absolute inset-0 grid place-items-center bg-slate-950/90 text-white"
                        >
                          <div class="text-center">
                            <span
                              class="material-symbols-outlined animate-spin text-4xl text-blue-400"
                              >progress_activity</span
                            >
                            <p class="mt-2 text-xs font-bold">
                              Uploading video…
                            </p>
                          </div>
                        </div>
                      }
                    </div>
                    <div
                      class="flex flex-col justify-between gap-5 rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-[#080D18]"
                    >
                      <div>
                        <h3 class="font-bold">Video options</h3>
                        <p
                          class="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300"
                        >
                          Upload MP4, WebM, OGG or MOV up to 250 MB. The product
                          page displays the video above the description.
                        </p>
                      </div>
                      <div class="space-y-3">
                        <label
                          [class.pointer-events-none]="uploadingVideo()"
                          class="block cursor-pointer rounded-xl bg-blue-600 px-4 py-3 text-center font-['JetBrains_Mono'] text-xs font-bold uppercase !text-white hover:bg-blue-700"
                          >{{
                            editor.promoVideoUrl
                              ? 'Replace video'
                              : 'Upload video'
                          }}<input
                            type="file"
                            accept="video/mp4,video/webm,video/ogg,video/quicktime"
                            class="hidden"
                            (change)="handleVideoFile($event)"
                        /></label>
                        @if (editor.promoVideoUrl) {
                          <button
                            type="button"
                            (click)="removeMedia('promoVideoUrl')"
                            [disabled]="removingMedia() === 'promoVideoUrl'"
                            class="w-full rounded-xl border border-red-200 px-4 py-3 text-xs font-bold text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300"
                          >
                            {{
                              removingMedia() === 'promoVideoUrl'
                                ? 'Removing…'
                                : 'Remove video'
                            }}
                          </button>
                        }
                      </div>
                    </div>
                  </div>
                  <label class="mt-5 block"
                    ><span class="field-label">YouTube, Vimeo or video URL</span
                    ><input
                      type="text"
                      [ngModel]="editor.promoVideoUrl"
                      (ngModelChange)="setPromoVideoUrl($event)"
                      name="promoVideoUrl"
                      placeholder="https://youtube.com/watch?v=…"
                      class="admin-field"
                    /><small class="field-help"
                      >After pasting a link, click Save changes.</small
                    ></label
                  >
                  <label class="mt-5 block"
                    ><span class="field-label"
                      >Live application preview URL</span
                    ><input
                      type="url"
                      [(ngModel)]="editor.previewUrl"
                      name="previewUrl"
                      placeholder="https://demo.example.com"
                      class="admin-field"
                    /><small class="field-help"
                      >Customers can open the working demo before
                      purchasing.</small
                    ></label
                  >
                </section>
              </div>
            }

            @if (section() === 'delivery') {
              <section class="editor-section space-y-7">
                <div class="section-heading">
                  <span class="material-symbols-outlined">cloud_download</span>
                  <div>
                    <h2>Buyer delivery</h2>
                    <p>
                      Choose a protected ZIP or an HTTPS Drive, Bunny, media or
                      private resource link.
                    </p>
                  </div>
                </div>
                <div
                  class="rounded-2xl border border-blue-200 bg-blue-50/70 p-5 dark:border-blue-900 dark:bg-blue-950/20"
                >
                  <label class="block"
                    ><span class="field-label">External delivery link</span
                    ><input
                      type="url"
                      pattern="https://.*"
                      [(ngModel)]="editor.deliveryUrl"
                      name="deliveryUrl"
                      placeholder="https://drive.google.com/..."
                      class="admin-field"
                    /><small class="field-help"
                      >Only verified buyers receive this address. When provided,
                      it opens instead of an uploaded ZIP.</small
                    ></label
                  >
                </div>
                <div class="delivery-divider"><span>OR</span></div>
                @if (!isNew()) {
                  <div
                    class="rounded-2xl border border-dashed border-slate-300 p-5 dark:border-slate-700"
                  >
                    <div
                      class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <h3 class="font-bold">Protected ZIP file</h3>
                        <p
                          class="mt-1 text-xs text-slate-600 dark:text-slate-300"
                        >
                          Maximum 50 MB. Replacing it keeps previous buyers'
                          access.
                        </p>
                        @if (selected()?.fileName) {
                          <p
                            class="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                          >
                            <span class="material-symbols-outlined text-base"
                              >folder_zip</span
                            >{{ selected()?.fileName }} ·
                            {{ fileSize(selected()?.fileSize || 0) }}
                          </p>
                        }
                      </div>
                      <div class="flex min-w-0 flex-col gap-2">
                        <input
                          type="file"
                          accept=".zip,application/zip"
                          (change)="chooseFile($event)"
                          class="max-w-full text-sm"
                        /><button
                          type="button"
                          (click)="uploadZip()"
                          [disabled]="!file || busy()"
                          class="rounded-lg border border-blue-600 px-4 py-2 text-xs font-bold text-blue-700 disabled:opacity-50 dark:text-blue-300"
                        >
                          {{ busy() ? 'Uploading…' : 'Upload ZIP' }}
                        </button>
                      </div>
                    </div>
                  </div>
                } @else {
                  <p
                    class="rounded-xl bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
                  >
                    Create the product first, then return to Delivery to upload
                    its ZIP file.
                  </p>
                }
                <div class="grid gap-5 md:grid-cols-2">
                  <label class="block"
                    ><span class="field-label">Download button text</span
                    ><input
                      maxlength="80"
                      [(ngModel)]="editor.downloadButtonText"
                      name="downloadButtonText"
                      placeholder="Download source files"
                      class="admin-field" /></label
                  ><label class="block"
                    ><span class="field-label">Buyer message</span
                    ><textarea
                      maxlength="2000"
                      rows="4"
                      [(ngModel)]="editor.buyerMessage"
                      name="buyerMessage"
                      placeholder="Thank you! Setup instructions are inside the package."
                      class="admin-field"
                    ></textarea>
                  </label>
                </div>
              </section>
            }

            @if (section() === 'settings') {
              <section class="editor-section space-y-5">
                <div class="section-heading">
                  <span class="material-symbols-outlined">tune</span>
                  <div>
                    <h2>Publishing settings</h2>
                    <p>
                      Control placement and visibility without deleting buyer
                      access.
                    </p>
                  </div>
                </div>
                <label class="setting-card"
                  ><input
                    type="checkbox"
                    [(ngModel)]="editor.isFeatured"
                    name="featured"
                  /><span
                    ><strong>Featured product</strong
                    ><small
                      >Place this product near the top of the UI Templates
                      store.</small
                    ></span
                  ></label
                >
                <label class="setting-card"
                  ><input
                    type="checkbox"
                    [(ngModel)]="editor.isPublished"
                    name="published"
                  /><span
                    ><strong>Published and visible</strong
                    ><small
                      >Customers can view it publicly. Checkout remains disabled
                      until a ZIP or external delivery link is saved.</small
                    ></span
                  ></label
                >
                <div
                  class="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
                >
                  <strong>Buyer protection:</strong> unpublishing a product
                  removes it from the store but never removes it from customers
                  who already purchased it.
                </div>
              </section>
            }
          </main>
        </form>
      }
    </div>
  `,
  styles: [
    `
      .editor-section {
        padding: 1.5rem;
      }
      @media (min-width: 640px) {
        .editor-section {
          padding: 2rem;
        }
      }
      .editor-nav {
        display: flex;
        align-items: center;
        gap: 0.65rem;
        border-radius: 0.75rem;
        padding: 0.8rem 0.9rem;
        color: #64748b;
        font-size: 0.8rem;
        font-weight: 700;
        text-align: left;
      }
      .editor-nav:hover {
        background: #f8fafc;
        color: #1d4ed8;
      }
      .editor-nav-active {
        background: #eff6ff;
        color: #1d4ed8;
        box-shadow: inset 3px 0 #2563eb;
      }
      .editor-nav .material-symbols-outlined {
        font-size: 1.15rem;
      }
      .field-label {
        display: block;
        margin-bottom: 0.45rem;
        color: #475569;
        font: 700 0.67rem 'JetBrains Mono';
        letter-spacing: 0.055em;
        text-transform: uppercase;
      }
      .field-help {
        display: block;
        margin-top: 0.4rem;
        color: #64748b;
        font-size: 0.72rem;
        line-height: 1.4;
      }
      .admin-field {
        width: 100%;
        border: 1px solid #cbd5e1;
        border-radius: 0.7rem;
        background: #fff;
        padding: 0.78rem 0.9rem;
        color: #0f172a;
        outline: none;
      }
      .admin-field:focus,
      .slug-field:focus-within {
        border-color: #2563eb;
        box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
      }
      .slug-field {
        display: flex;
        align-items: center;
        overflow: hidden;
        border: 1px solid #cbd5e1;
        border-radius: 0.7rem;
        background: #fff;
        color: #64748b;
      }
      .slug-field span {
        padding-left: 0.85rem;
        font: 600 0.78rem 'JetBrains Mono';
      }
      .slug-field input {
        min-width: 0;
        flex: 1;
        border: 0;
        background: transparent;
        padding: 0.78rem 0.85rem 0.78rem 0.25rem;
        color: #0f172a;
        outline: none;
      }
      .section-heading {
        display: flex;
        align-items: flex-start;
        gap: 0.8rem;
      }
      .section-heading > .material-symbols-outlined {
        border-radius: 0.65rem;
        background: #dbeafe;
        padding: 0.55rem;
        color: #1d4ed8;
      }
      .section-heading h2 {
        color: #0f172a;
        font-size: 1.2rem;
        font-weight: 800;
      }
      .section-heading p {
        margin-top: 0.15rem;
        color: #64748b;
        font-size: 0.8rem;
      }
      .setting-card {
        display: flex;
        cursor: pointer;
        align-items: flex-start;
        gap: 1rem;
        border: 1px solid #e2e8f0;
        border-radius: 1rem;
        padding: 1.15rem;
      }
      .setting-card:hover {
        border-color: #60a5fa;
        background: #f8fafc;
      }
      .setting-card input {
        margin-top: 0.15rem;
        width: 1.2rem;
        height: 1.2rem;
      }
      .setting-card strong,
      .setting-card small {
        display: block;
      }
      .setting-card strong {
        color: #0f172a;
      }
      .setting-card small {
        margin-top: 0.3rem;
        color: #64748b;
        line-height: 1.5;
      }
      .delivery-divider {
        display: flex;
        align-items: center;
        gap: 1rem;
        color: #94a3b8;
        font: 700 0.65rem 'JetBrains Mono';
      }
      .delivery-divider::before,
      .delivery-divider::after {
        content: '';
        height: 1px;
        flex: 1;
        background: #e2e8f0;
      }
      .admin-toast {
        position: fixed;
        z-index: 100;
        right: 1.25rem;
        top: 6.25rem;
        display: flex;
        max-width: 25rem;
        gap: 0.75rem;
        border-radius: 1rem;
        padding: 1rem 1.1rem;
        box-shadow: 0 18px 50px rgba(15, 23, 42, 0.2);
        animation: toast-in 0.28s ease-out both;
      }
      .admin-toast strong,
      .admin-toast span:not(.material-symbols-outlined) {
        display: block;
      }
      .admin-toast span:not(.material-symbols-outlined) {
        margin-top: 0.12rem;
        font-size: 0.78rem;
      }
      .admin-toast-success {
        border: 1px solid #86efac;
        background: #f0fdf4;
        color: #166534;
      }
      .admin-toast-error {
        border: 1px solid #fca5a5;
        background: #fef2f2;
        color: #991b1b;
      }
      @keyframes toast-in {
        from {
          opacity: 0;
          transform: translateY(-12px) scale(0.97);
        }
        to {
          opacity: 1;
          transform: none;
        }
      }
      :host-context(.dark-theme) .editor-nav:hover {
        background: #080d18;
        color: #60a5fa;
      }
      :host-context(.dark-theme) .editor-nav-active {
        background: rgba(30, 64, 175, 0.24);
        color: #60a5fa;
      }
      :host-context(.dark-theme) .field-label {
        color: #94a3b8;
      }
      :host-context(.dark-theme) .admin-field,
      :host-context(.dark-theme) .slug-field {
        border-color: #334155;
        background: #040810;
        color: #fff;
      }
      :host-context(.dark-theme) .slug-field input {
        color: #fff;
      }
      :host-context(.dark-theme) .section-heading > .material-symbols-outlined {
        background: rgba(30, 64, 175, 0.35);
        color: #60a5fa;
      }
      :host-context(.dark-theme) .section-heading h2,
      :host-context(.dark-theme) .setting-card strong {
        color: #fff;
      }
      :host-context(.dark-theme) .section-heading p,
      :host-context(.dark-theme) .setting-card small {
        color: #94a3b8;
      }
      :host-context(.dark-theme) .setting-card {
        border-color: #334155;
      }
      :host-context(.dark-theme) .setting-card:hover {
        border-color: #3b82f6;
        background: #080d18;
      }
      :host-context(.dark-theme) .delivery-divider::before,
      :host-context(.dark-theme) .delivery-divider::after {
        background: #334155;
      }
    `,
  ],
})
export class AdminTemplateEditorComponent implements OnInit, OnDestroy {
  private readonly service = inject(TemplatesService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly sanitizer = inject(DomSanitizer);
  private messageTimer?: ReturnType<typeof setTimeout>;

  readonly productId = signal<string | null>(null);
  readonly product = signal<AdminUiTemplate | null>(null);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly uploadingImage = signal(false);
  readonly uploadingVideo = signal(false);
  readonly removingMedia = signal<'thumbnail' | 'promoVideoUrl' | null>(null);
  readonly feedback = signal('');
  readonly error = signal('');
  readonly section = signal<EditorSection>('product');
  readonly promoEmbedUrl = signal<SafeResourceUrl | null>(null);

  file: File | null = null;
  editor: Editor = this.blank();
  selected = () => this.product();
  isNew = () => !this.productId();

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id || id === 'new') {
      this.loading.set(false);
      return;
    }
    this.productId.set(id);
    this.service.getAdmin(id).subscribe({
      next: (item) => {
        this.applyProduct(item);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.showError(
          'This product could not be loaded. Return to UI Templates and try again.',
        );
      },
    });
  }

  ngOnDestroy() {
    if (this.messageTimer) clearTimeout(this.messageTimer);
  }

  blank(): Editor {
    return {
      title: '',
      slug: '',
      tagline: '',
      description: '',
      thumbnail: '',
      promoVideoUrl: '',
      previewUrl: '',
      deliveryUrl: '',
      downloadButtonText: 'Download files',
      buyerMessage: '',
      price: 0,
      currency: 'INR',
      category: 'Website UI',
      tagsText: '',
      isPublished: false,
      isFeatured: false,
    };
  }

  save(form: NgForm) {
    if (form.invalid || this.busy()) {
      if (form.invalid)
        this.showError(
          'Complete the required product information before saving.',
        );
      return;
    }
    this.clearMessages();
    this.busy.set(true);
    const request = this.productId()
      ? this.service.update(this.productId()!, this.payload())
      : this.service.create(this.payload());
    request.subscribe({
      next: (item) => {
        const created = !this.productId();
        this.busy.set(false);
        this.applyProduct(item);
        form.form.markAsPristine();
        this.showSuccess(
          created
            ? 'Product created. You can now add its delivery file.'
            : 'Your changes are visible in the admin and storefront.',
        );
        if (created)
          this.router.navigate(['/admin/templates', item.id, 'manage'], {
            replaceUrl: true,
          });
      },
      error: (error) => {
        this.busy.set(false);
        this.showError(
          error?.error?.message || 'The product could not be saved.',
        );
      },
    });
  }

  handleThumbnailFile(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (
      !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(
        file.type,
      )
    ) {
      this.showError('Choose a JPG, PNG, WebP or GIF image.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      this.showError('Choose an image smaller than 10 MB.');
      return;
    }
    this.uploadingImage.set(true);
    this.service.uploadMedia('image', file).subscribe({
      next: ({ url }) => {
        this.uploadingImage.set(false);
        this.persistMediaField(
          'thumbnail',
          url,
          'Thumbnail uploaded and saved.',
        );
      },
      error: (error) => {
        this.uploadingImage.set(false);
        this.showError(error?.error?.message || 'The thumbnail upload failed.');
      },
    });
  }

  handleVideoFile(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (
      !['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'].includes(
        file.type,
      )
    ) {
      this.showError('Choose an MP4, WebM, OGG or MOV video.');
      return;
    }
    if (file.size > 250 * 1024 * 1024) {
      this.showError('Choose a promotional video smaller than 250 MB.');
      return;
    }
    this.uploadingVideo.set(true);
    this.service.uploadMedia('video', file).subscribe({
      next: ({ url }) => {
        this.uploadingVideo.set(false);
        this.persistMediaField(
          'promoVideoUrl',
          url,
          'Promotional video uploaded and saved.',
        );
      },
      error: (error) => {
        this.uploadingVideo.set(false);
        this.showError(error?.error?.message || 'The video upload failed.');
      },
    });
  }

  removeMedia(field: 'thumbnail' | 'promoVideoUrl') {
    const currentUrl = String(this.editor[field] || '');
    if (!currentUrl || this.removingMedia()) return;
    this.removingMedia.set(field);
    const clear = () => {
      this.removingMedia.set(null);
      this.persistMediaField(
        field,
        '',
        field === 'thumbnail'
          ? 'Thumbnail removed.'
          : 'Promotional video removed.',
      );
    };
    if (currentUrl.includes('/uploads/course-media/')) {
      this.service.removeMedia(currentUrl).subscribe({
        next: clear,
        error: (error) => {
          this.removingMedia.set(null);
          this.showError(
            error?.error?.message || 'The uploaded media could not be removed.',
          );
        },
      });
    } else {
      clear();
    }
  }

  persistMediaField(
    field: 'thumbnail' | 'promoVideoUrl',
    url: string,
    message: string,
  ) {
    this.editor = { ...this.editor, [field]: url };
    if (field === 'promoVideoUrl') this.updatePromoPreview(url);
    const id = this.productId();
    if (!id) {
      this.showSuccess(
        `${message.replace(/ and saved\.$/, '.')} Create the product to keep it.`,
      );
      return;
    }
    this.service.update(id, { [field]: url }).subscribe({
      next: (item) => {
        this.applyProduct(item);
        this.showSuccess(message);
      },
      error: (error) =>
        this.showError(
          error?.error?.message ||
            'The media uploaded, but the product could not be updated.',
        ),
    });
  }

  setPromoVideoUrl(value: string) {
    this.editor = { ...this.editor, promoVideoUrl: value };
    this.updatePromoPreview(value);
  }

  chooseFile(event: Event) {
    this.file = (event.target as HTMLInputElement).files?.[0] || null;
  }

  uploadZip() {
    const id = this.productId();
    if (!this.file || !id || this.busy()) return;
    this.clearMessages();
    this.busy.set(true);
    this.service.upload(id, this.file).subscribe({
      next: (item) => {
        this.busy.set(false);
        this.file = null;
        this.applyProduct(item);
        this.showSuccess(
          'ZIP uploaded securely. Existing and future buyers can download it.',
        );
      },
      error: (error) => {
        this.busy.set(false);
        this.showError(error?.error?.message || 'ZIP upload failed.');
      },
    });
  }

  remove() {
    const id = this.productId();
    if (
      !id ||
      !window.confirm(
        'Delete this product? Products with buyers cannot be deleted.',
      )
    )
      return;
    this.service.remove(id).subscribe({
      next: () =>
        this.router.navigate(['/admin'], { queryParams: { tab: 'templates' } }),
      error: (error) =>
        this.showError(
          error?.error?.message || 'Product could not be deleted.',
        ),
    });
  }

  isDirectVideo(value: unknown) {
    const url = String(value || '')
      .toLowerCase()
      .split('?')[0];
    return (
      url.includes('/uploads/course-media/video-') ||
      /\.(?:mp4|webm|ogv|mov)$/.test(url)
    );
  }

  fileSize(size: number) {
    return size ? (size / 1024 / 1024).toFixed(1) + ' MB' : '0 MB';
  }

  formatDate(value?: string) {
    if (!value) return 'recently';
    return new Intl.DateTimeFormat('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  }

  private payload() {
    return {
      ...this.editor,
      tags: this.editor.tagsText
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    };
  }

  private applyProduct(item: AdminUiTemplate) {
    this.productId.set(item.id);
    this.product.set(item);
    this.editor = { ...item, tagsText: item.tags.join(', ') };
    this.updatePromoPreview(item.promoVideoUrl || '');
  }

  private updatePromoPreview(value: string) {
    this.promoEmbedUrl.set(this.toPromoEmbedUrl(value));
  }

  private toPromoEmbedUrl(value: string): SafeResourceUrl | null {
    const clean = String(value || '').trim();
    if (!clean || this.isDirectVideo(clean)) return null;
    let embed = '';
    try {
      const url = new URL(clean);
      if (url.hostname.includes('youtu.be'))
        embed = `https://www.youtube-nocookie.com/embed/${url.pathname.slice(1)}`;
      else if (url.hostname.includes('youtube.com')) {
        const id =
          url.searchParams.get('v') ||
          url.pathname.split('/').filter(Boolean).pop();
        if (id) embed = `https://www.youtube-nocookie.com/embed/${id}`;
      } else if (url.hostname.includes('vimeo.com')) {
        const id = url.pathname.split('/').filter(Boolean).pop();
        if (id) embed = `https://player.vimeo.com/video/${id}`;
      }
    } catch {
      return null;
    }
    return embed ? this.sanitizer.bypassSecurityTrustResourceUrl(embed) : null;
  }

  private clearMessages() {
    this.feedback.set('');
    this.error.set('');
    if (this.messageTimer) clearTimeout(this.messageTimer);
  }

  private showSuccess(message: string) {
    this.error.set('');
    this.feedback.set(message);
    if (this.messageTimer) clearTimeout(this.messageTimer);
    this.messageTimer = setTimeout(() => this.feedback.set(''), 6000);
  }

  private showError(message: string) {
    this.feedback.set('');
    this.error.set(message);
    if (this.messageTimer) clearTimeout(this.messageTimer);
    this.messageTimer = setTimeout(() => this.error.set(''), 9000);
  }
}
