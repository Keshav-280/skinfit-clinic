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
  /** Natural left profile — FaceType 1, White light only. */
  left: Buffer | null;
  /** Natural front / centre — FaceType 2, White light only. */
  front: Buffer | null;
  /** Natural right profile — FaceType 3, White light only. */
  right: Buffer | null;
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
