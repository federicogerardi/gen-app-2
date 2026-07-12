export interface QuotaDisplayConsumerValue {
  readonly isQuotaVisible: boolean;
}

export const useQuotaDisplayConsumer = (): QuotaDisplayConsumerValue => {
  return {
    isQuotaVisible: false,
  };
};
