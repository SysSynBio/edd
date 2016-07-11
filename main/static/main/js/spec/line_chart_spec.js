describe('Test create line graph with jasmine ', function() {
  var c;

  beforeEach(function() {
    //from study/117
    var selector = ".linechart"
    var graphset = {"assayMeasurements":[{"label":"dt4933","x":11,"y":0.03,"x_unit":"n/a","y_unit":"n/a","name":"WT+RFP glycerol-OD600-RFP glycerol"},{"label":"dt4933","x":12,"y":0.0645,"x_unit":"n/a","y_unit":"n/a","name":"WT+RFP glycerol-OD600-RFP glycerol"}],
                    "x_axis": function(x) {return d3.svg.axis().scale(x).orient("left").ticks(5);}, "y_axis": function(y) {return d3.svg.axis().scale(y).orient("left").ticks(5);}}
    c = createLineGraph(graphset, selector);
    c.render();
  });

  afterEach(function() {
    d3.selectAll('svg').remove();
  });

  describe('the svg' ,function() {
    it('should be created', function() {
        expect(getSvg()).not.toBeNull();
    });

  });

  describe('working with data' ,function() {

    var testData =  [{"label":"dt4933","x":11,"y":0.03,"x_unit":"n/a","y_unit":"n/a","name":"WT+RFP glycerol-OD600-RFP glycerol"},{"label":"dt4933","x":12,"y":0.0645,"x_unit":"n/a","y_unit":"n/a","name":"WT+RFP glycerol-OD600-RFP glycerol"}]

    it('should be able to update the data', function() {
      c.setData(testData);
      expect(c.getData()).not.toBeNull();
    });

    it('should nest data based on protein name', function() {
      c.setData(testData);
      expect(c.getData()[0].key).toBe("WT+RFP glycerol-OD600-RFP glycerol");
    });

    it('should have the correct x value', function() {
      c.setData(testData);
      expect(c.getData()[0].values[0].values[0].x ).toBe(11);
    });

  });

  describe('create bars' ,function() {
    it('should render the correct number of bars', function() {
        expect(getBars().length).toBe(1);
    });

    it('should render the bars with correct y', function() {
        expect(d3.select(getBars()[0]).attr('y')).toBeCloseTo(0);
    });
});


  function getSvg() {
    return d3.select('svg');
  }

  function getBars() {
    return d3.selectAll('.bar')[0];
}

});
