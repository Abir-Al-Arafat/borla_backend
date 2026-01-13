export type QueryObject = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
};

export type ISignup = {
  name: string;
  email: string;
  phoneNumber: string;
  location?: {
    type: 'Point';
    coordinates: [number, number];
  };
  locationName?: string;
  password: string;
  confirmPassword: string;
};

export type ILogin = {
  phoneNumber: string;
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

export type ISocialAuth = {
  email: string;
  name: string;
  socialId: string;
  provider: 'google' | 'apple';
  phoneNumber?: string;
  profile?: string;
};
