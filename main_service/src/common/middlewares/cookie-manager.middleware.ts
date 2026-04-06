import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SessionMiddleware implements NestMiddleware {

  private SESSION_EXPIRY_TIME: number;

  constructor(private readonly configService: ConfigService) {
    this.SESSION_EXPIRY_TIME = this.configService.getOrThrow<number>('SESSION_EXPIRY_TIME');
  }

  use(req: Request, res: Response, next: NextFunction): void {
    const existing = req.signedCookies['sessionId'];
    const newSessionId = existing ?? uuidv4();
  
    if (!existing) {
      req['sessionId'] = newSessionId;
    }

    console.log('newSessionId', newSessionId);


    const originalSend = res.send;

    res.send = (body: any) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        res.cookie('sessionId', newSessionId, {
          httpOnly: true,
          sameSite: 'strict',
          signed: true,
          maxAge: this.SESSION_EXPIRY_TIME * 1000,
        });
      }

      res.send = originalSend;
      return res.send(body);
    };    


    next();
  }
}