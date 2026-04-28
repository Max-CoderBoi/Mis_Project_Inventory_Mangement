export function calculateMovingAverage(values: number[], period: number) {
  if (values.length === 0) return [];
  return values.map((_, index) => {
    const start = Math.max(0, index - period + 1);
    const window = values.slice(start, index + 1);
    return window.reduce((sum, value) => sum + value, 0) / window.length;
  });
}

export function calculateWeightedMovingAverage(values: number[], period: number) {
  if (values.length === 0) return [];
  return values.map((_, index) => {
    const start = Math.max(0, index - period + 1);
    const window = values.slice(start, index + 1);
    const weights = window.map((_, idx) => idx + 1);
    const weightedSum = window.reduce((sum, value, idx) => sum + value * weights[idx], 0);
    const totalWeight = weights.reduce((sum, value) => sum + value, 0);
    return weightedSum / Math.max(totalWeight, 1);
  });
}

export function calculateExponentialSmoothing(values: number[], alpha = 0.35) {
  if (values.length === 0) return [];
  return values.reduce<number[]>((smoothed, value, idx) => {
    if (idx === 0) {
      smoothed.push(value);
    } else {
      const previous = smoothed[idx - 1];
      smoothed.push(alpha * value + (1 - alpha) * previous);
    }
    return smoothed;
  }, []);
}

export function calculateTrendForecast(values: number[], horizon: number) {
  const n = values.length;
  if (n < 2) {
    return Array(horizon).fill(values[n - 1] ?? 0);
  }

  const x = values.map((_, index) => index + 1);
  const xMean = x.reduce((sum, value) => sum + value, 0) / n;
  const yMean = values.reduce((sum, value) => sum + value, 0) / n;
  const numerator = values.reduce((sum, value, index) => sum + (index + 1 - xMean) * (value - yMean), 0);
  const denominator = values.reduce((sum, _, index) => sum + Math.pow(index + 1 - xMean, 2), 0);
  const slope = denominator === 0 ? 0 : numerator / denominator;
  const intercept = yMean - slope * xMean;

  return Array.from({ length: horizon }, (_, index) => {
    return Math.max(0, intercept + slope * (n + index + 1));
  });
}

export function calculateWeeklySeasonalityFactors(dates: string[], values: number[]) {
  if (dates.length === 0 || values.length === 0) {
    return Array(7).fill(1);
  }

  const averages = Array(7).fill(0);
  const counts = Array(7).fill(0);

  dates.forEach((date, index) => {
    const weekday = new Date(date).getDay();
    averages[weekday] += values[index];
    counts[weekday] += 1;
  });

  const overallAverage = values.reduce((sum, value) => sum + value, 0) / values.length;
  return averages.map((total, index) => {
    const dayAverage = counts[index] ? total / counts[index] : overallAverage;
    return overallAverage > 0 ? dayAverage / overallAverage : 1;
  });
}

export function calculateStandardDeviation(values: number[]) {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

export function calculateForecastConfidenceBand(values: number[], actualValues: number[], multiplier = 1.25) {
  const sigma = calculateStandardDeviation(actualValues);
  return {
    lower: values.map((forecast) => Math.max(0, Math.round(forecast - sigma * multiplier))),
    upper: values.map((forecast) => Math.round(forecast + sigma * multiplier)),
  };
}

export function calculateReorderLevel(avgDailyDemand: number, leadTimeDays: number, safetyStock: number) {
  return Math.max(1, Math.round(avgDailyDemand * leadTimeDays + safetyStock));
}

export function calculateStatus(currentStock: number, reorderLevel: number, safetyStock: number) {
  if (currentStock === 0) return "Out of Stock" as const;
  if (currentStock <= safetyStock) return "Critical" as const;
  if (currentStock <= reorderLevel) return "Low" as const;
  return "In Stock" as const;
}
