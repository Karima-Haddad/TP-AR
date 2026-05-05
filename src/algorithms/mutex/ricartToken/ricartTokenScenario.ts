import { RicartTokenEngine } from "./ricartTokenAlgo";

export function buildScenarioJeton() {
  const algo = new RicartTokenEngine(5, 3);

  algo.requestCS(1);
  algo.deliverAllRequests(1);
  algo.deliverToken(3, 1);

  algo.releaseCS(1);

  algo.requestCS(3);
  algo.deliverAllRequests(3);
  algo.deliverToken(1, 3);

  algo.requestCS(5);
  algo.deliverAllRequests(5);

  algo.requestCS(1);
  algo.deliverAllRequests(1);

  algo.releaseCS(3);
  algo.deliverToken(3, 5);

  algo.releaseCS(5);
  algo.deliverToken(5, 1);

  algo.releaseCS(1);

  return algo.getSteps();
}