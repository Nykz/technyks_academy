import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class SignupDto {
  @IsEmail({}, { message: 'Enter a valid email address.' })
  @MaxLength(191)
  email!: string;

  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters.' })
  @MaxLength(200)
  password?: string;

  @IsString()
  @MinLength(1, { message: 'Name is required.' })
  @MaxLength(191)
  name!: string;
}

export class LoginDto {
  @IsEmail({}, { message: 'Enter a valid email address.' })
  @MaxLength(191)
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  password?: string;
}

export class GoogleLoginDto {
  @IsString()
  @MinLength(1, { message: 'A Google credential is required.' })
  credential!: string;
}

export class ForgotPasswordDto {
  @IsEmail({}, { message: 'Enter a valid email address.' })
  @MaxLength(191)
  email!: string;
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(1, { message: 'A reset token is required.' })
  token!: string;

  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters.' })
  @MaxLength(200)
  newPassword?: string;
}

const LEARNER_GOALS = [
  'learn-from-scratch',
  'build-projects',
  'advance-career',
  'ai-automation',
] as const;
const EXPERIENCE_LEVELS = [
  'new-to-coding',
  'learning-fundamentals',
  'building-projects',
  'working-developer',
] as const;

export class CompleteOnboardingDto {
  @IsIn(LEARNER_GOALS as unknown as string[], {
    message: 'Select a valid learning goal.',
  })
  learnerGoal!: string;

  @IsIn(EXPERIENCE_LEVELS as unknown as string[], {
    message: 'Select a valid experience level.',
  })
  experienceLevel!: string;

  @IsString()
  @MaxLength(80)
  membershipPreference!: string;
}
