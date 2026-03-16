import { IsNotEmpty, IsString, MaxLength, MinLength } from '@nestjs/class-validator';

export class SseStreamQueryDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(10000)
  text: string;
}
