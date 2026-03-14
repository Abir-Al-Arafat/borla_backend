export interface ISendMessagePayload {
  bookingId: string;
  text?: string;
  imagePaths?: string[];
}

export interface IGetMessagesQuery {
  page?: number;
  limit?: number;
}

export interface IGetChatsQuery {
  page?: number;
  limit?: number;
}
