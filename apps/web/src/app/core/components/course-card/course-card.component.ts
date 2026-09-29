import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Course } from '../../services/courses.service';

import { LocalPricePipe } from '../../pipes/local-price.pipe';

@Component({
  selector: 'app-course-card',
  standalone: true,
  imports: [CommonModule, RouterModule, LocalPricePipe],
  template: `
    <article class="bg-[#121A2B] border border-[#1E293B] rounded-lg flex flex-col overflow-hidden group hover:border-[#3B82F6] transition-all shadow-xl h-full">
      <a [routerLink]="['/courses', course.slug]" class="flex flex-col flex-1">
        <div class="relative w-full aspect-video overflow-hidden border-b border-[#1E293B] bg-[#040810]">
          <img
            [src]="course.thumbnail || '/assets/course-agentic-ai.png'"
            [alt]="course.title"
            class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          <div class="absolute inset-0 bg-gradient-to-t from-[#121A2B] via-transparent to-transparent opacity-80"></div>
          <span class="absolute top-3 left-3 font-['JetBrains_Mono'] text-[10px] text-[#040810] bg-[#3B82F6] px-2.5 py-1 rounded font-bold uppercase">
            {{ course.isFree ? 'Free' : 'Premium' }}
          </span>
          <span class="absolute top-3 right-3 font-['JetBrains_Mono'] text-[10px] !text-white !bg-[#0f172a]/95 backdrop-blur-md border border-white/20 px-2.5 py-1 rounded font-semibold uppercase shadow-sm">
            {{ course.level }}
          </span>
        </div>

        <div class="p-5 flex flex-col flex-1">
          <h2 class="font-['Hanken_Grotesk'] text-lg font-bold text-white mb-2 group-hover:text-[#3B82F6] transition-colors leading-snug">
            {{ course.title }}
          </h2>
          <p class="font-['Inter'] text-sm text-[#d9c3af] mb-5 line-clamp-3 leading-relaxed">
            {{ course.subtitle || course.description }}
          </p>

          <div class="flex items-center gap-2 mb-4 font-['JetBrains_Mono'] text-xs">
            <span class="text-[#3B82F6] font-bold">{{ (course.rating || 0) | number:'1.1-1' }} ★</span>
            <span class="text-[#a18d7b]">({{ course.reviewCount || 0 }} reviews)</span>
          </div>

          <div class="grid grid-cols-2 gap-y-3 gap-x-2 pt-4 border-t border-[#1E293B]/60 font-['JetBrains_Mono'] text-[11px] text-[#a18d7b] mt-auto">
            <div class="flex items-center gap-1.5">
              <span class="material-symbols-outlined text-sm text-[#3B82F6]">schedule</span>
              {{ formatDuration() }}
            </div>
            <div class="flex items-center gap-1.5">
              <span class="material-symbols-outlined text-sm text-[#3B82F6]">layers</span>
              {{ course.modules.length || 0 }} sections
            </div>
            <div class="flex items-center gap-1.5 col-span-2">
              <span class="material-symbols-outlined text-sm text-[#3B82F6]">play_lesson</span>
              {{ totalLessons() }} lessons · certificate included
            </div>
          </div>
        </div>
      </a>

      <div class="px-5 py-4 flex items-center justify-between border-t border-[#1E293B]/40 bg-[#0b0f10]/40">
        <div class="font-['JetBrains_Mono'] text-lg font-bold text-[#3B82F6]">
          {{ course.isFree ? 'FREE' : (course.price | localPrice) }}
        </div>
        <a
          [routerLink]="['/courses', course.slug]"
          class="font-['JetBrains_Mono'] text-xs font-bold text-[#3B82F6] hover:text-[#3B82F6] flex items-center gap-1 group-hover:gap-2 transition-all"
        >
          View course
          <span class="material-symbols-outlined text-sm">arrow_forward</span>
        </a>
      </div>
    </article>
  `,
})
export class CourseCardComponent {
  @Input({ required: true }) course!: Course;

  totalLessons(): number {
    return this.course.modules?.reduce((total, module) => total + (module.lessons?.length || 0), 0) || 0;
  }

  formatDuration(): string {
    const minutes = Math.round(
      (this.course.modules || []).reduce(
        (total, module) => total + (module.lessons || []).reduce((moduleTotal, lesson) => moduleTotal + (lesson.duration || 0), 0),
        0,
      ) / 60,
    );
    if (minutes < 60) return `${minutes} mins`;
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
  }
}
