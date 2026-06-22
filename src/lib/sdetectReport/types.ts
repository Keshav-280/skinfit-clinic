export type SdetectMetric = {
  label: string;
  score: number;
};

export type SdetectPatient = {
  name: string;
  gender: string;
  age: number;
  phone: string;
  reportDate: string;
  scanFrequency: number;
};

export type SdetectFaceImages = {
  front: Buffer;
  left: Buffer;
  right: Buffer;
};

export type SdetectReportData = {
  classification: string;
  moisture: number;
  comprehensiveScore: number;
  patient: SdetectPatient;
  radar: SdetectMetric[];
  issueAnalysis: string;
  skincareAdvice: string[];
  generalAnalysis: SdetectMetric[];
  inDepthAnalysis: SdetectMetric[];
  faceImages: SdetectFaceImages | null;
  sourceReportUrl: string | null;
  reportSn: string | null;
};
