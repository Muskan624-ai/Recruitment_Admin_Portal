import { Request, Response, NextFunction } from 'express';

export interface CustomRequest extends Request {
  user?: {
    role: string;
  };
}

export const authorizeRole = (allowedRoles: string[]) => {
  return (req: CustomRequest, res: Response, next: NextFunction) => {
    
    const userRole = req.user?.role; 

    if (!userRole || !allowedRoles.includes(userRole)) {
      return res.status(403).json({ message: "Access Denied: Invalid Role" });
    }
    
    next();
  };
};