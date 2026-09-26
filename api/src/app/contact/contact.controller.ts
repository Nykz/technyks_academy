import { Throttle } from '@nestjs/throttler';
import { Body, Controller, Post } from '@nestjs/common';
import { ContactService, ContactSubmission } from './contact.service';

@Controller('contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Throttle({ default: { limit: 5, ttl: 600_000 } })
  @Post()
  submitMessage(@Body() submission: ContactSubmission) {
    return this.contactService.createMessage(submission);
  }
}
