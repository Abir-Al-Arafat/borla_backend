export type QueryObject = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
};

export type ILogin = {
  email: string;
  password: string;
};
export type IChangePassword = {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
};
export type IResetPassword = {
  newPassword: string;
  confirmPassword: string;
};

export interface IJwtPayload {
  userId: string;
  role: string;
}


export interface JwtPayload {
  userId: string;
  role: string;
}