
var Carousel = function(container) {
  this.container = container;
  this.items = container.children();
  this.itemCount = this.items.size();
  this.itemWidth = this.items.first().outerWidth(true);
  this.position = 0;
  this.positionRounded = 0;
  this.dragX = 0;
  this.dragPosition = 0;
  this.dragEnergy = 0;
  this.dragClick = false;
  this.drag = false;
  this.moving = false;
  this.transitioning = false;
  this.frameskip = 1;
  this.touch = ('ontouchstart' in window);
  var self = this;

  // easing
  jQuery.easing['_carousel_easing'] = function (x, t, b, c, d) {
    return (t==d) ? b+c : c * (-Math.pow(2, -10 * t/d) + 1) + b;
  }

  // IE sux, set frameskip
  if ($.browser.msie && $.browser.version <= 8)
  {
    this.frameskip = 4;
  }

  this.onchange = function() {};
  this.onclick = function() {};

  if (this.touch)
  {
    this.touchEvents();
  }
  else
  {
    this.mouseEvents();
  }
}

Carousel.prototype.setWidth = function(w)
{
  this.itemWidth = w;
}

Carousel.prototype.dragStart = function(x)
{
  if (!this.drag && !this.moving)
  {
    this.drag = true;
    this.dragX = x;
    this.dragDistance = 0;
    this.dragStarted = new Date();
    this.dragClick = true;
  }
}

Carousel.prototype.dragMove = function(x)
{
  var self = this;
  var dx = self.dragX - x;
  if (this.drag)
  {
    // if movement direction is changed, reset kinetic energy
    if (dx > 0 && self.dragDistance < 0 || dx < 0 && self.dragDistance > 0)
    {
      self.dragDistance = 0;
      self.dragStarted = new Date();
    }

    clearInterval(this.dragInterval);
    this.dragInterval = null;
    this.dragClick = false;

    self.dragDistance += dx;

    var new_position = self.position + dx/self.itemWidth;

    // check limits
    if (new_position < 0 || new_position > self.itemCount-1)
    {
      self.dragDistance = 0;
      self.dragStarted = new Date();

      if (new_position < 0)
      {
        new_position = 0;
      }
      if (new_position > self.itemCount-1)
      {
        new_position = self.itemCount-1;
      }
    }

    self.moveStep(new_position);
    self.dragX = x;
  }
}

Carousel.prototype.dragEnd = function()
{
  var self = this;
  if (self.drag)
  {
    var dt = 10;
    var timeElapsed = (new Date() - self.dragStarted) / 1000; // in seconds
    var energy = (self.dragDistance / timeElapsed)/(1000/dt)*2;
    var dx_min = 0.01;

    self.drag = false;

    if (self.dragClick)
    {
      // clicked
      this.onclick(this.positionRounded);
      return;
    }

    if (energy == 0 || isNaN(energy))
    {
      return;
    }

    // calculate total distance
    // 1. calculate number of iterations (energy*0.95^x = dx_min where x equals number of iterations)
    var steps = Math.ceil(Math.log(dx_min/Math.abs(energy)) / Math.log(0.95));

    // 2. calculate sum of the x numbers in geometric sequence energy*0.95^x
    var distance = energy*(Math.pow(0.95, steps)-1)/(0.95-1);
    var old_distance = distance; // distance before correction

    // increase distance to stop on next full item
    distance += self.position*self.itemWidth;
    if (energy > 0)
      distance = Math.ceil(distance/self.itemWidth)*self.itemWidth;
    else
      distance = Math.floor(distance/self.itemWidth)*self.itemWidth;

    // check limits
    var upper_limit = (self.itemCount-1) * self.itemWidth;
    if (distance > upper_limit)
      distance = upper_limit;
    else if (distance < 0)
      distance = 0;

    distance -= self.position * self.itemWidth;

    // calculate how many additional steps do we need
    var additional_steps = -(Math.log(distance/old_distance)/Math.log(0.95));

    // increase energy by 1/(0.95*additional_steps)
    energy *= Math.pow(0.95, -additional_steps);

    clearInterval(self.dragInterval);

    var traveled = 0;

    self.dragInterval = setInterval(function() {
      var dx = 0;
      for (var i = 0; i < self.frameskip; i++)
      {
        dx += energy/self.itemWidth;
        traveled += dx;
        energy *= 0.95;
      }

      self.moveStep(self.position + dx);

      if (Math.abs(energy) <= dx_min || Math.abs(traveled)*self.itemWidth >= Math.abs(distance) - 1)
      {
        clearInterval(self.dragInterval);
        self.dragInterval = null;
        self.moveStep(Math.round(self.position));
      }
    }, dt*self.frameskip);
  }
}

Carousel.prototype.mouseEvents = function()
{
  var self = this;

  this.container.find('a').bind('drag click', function(e) {
    e.preventDefault();
  });

  this.container.mousedown(function(e) {
    if (e.which == 1) // left button only
    {
      e.preventDefault();
      e.stopPropagation();
      self.dragStart(e.pageX);
    }
  });
  $('body').mousemove(function(e) {
    self.dragMove(e.pageX);
  }).mouseup(function(e) {
    self.dragEnd();
  });
}

Carousel.prototype.touchEvents = function()
{
  var self = this;

  var c = this.container.get(0);

  c.ontouchstart = function(e) {
    e.preventDefault();
    e.stopPropagation();
    self.dragStart(e.touches[0].pageX);
  }

  var body = $('body').get(0);

  body.ontouchmove = function(e) {
    self.dragMove(e.touches[0].pageX);
  }
  body.ontouchend = function(e) {
    self.dragEnd();
  }
}

Carousel.prototype.moveStep = function(x) {
  this.container.css('margin-left', -x*this.itemWidth);
  this.position = x;

  var rounded = Math.round(this.position);
  if (rounded != this.positionRounded)
  {
    this.positionRounded = rounded;
    this.onchange(rounded);
  }
}

Carousel.prototype.moveTo = function(destination) {
  if (!this.dragInterval && !this.moving)
  {
    var self = this;

    this.moving = true;

    var n = $(this.items[this.position]).clone(true, true); // we need to copy fake drag handler too
    n.css({'position': 'absolute', 'z-index': 100, 'left': 0, 'top': 0});
    n.appendTo(this.container);

    this.moveStep(destination);

    $({opacity: 1}).animate({opacity: 0}, {
      duration: 500,
      easing: 'linear',
      step: function(now, fx) {
        // I love IE
        if ($.browser.msie)
        {
          var ie = Math.round(now * 100);
          n.css('filter', 'alpha(opacity=' + ie + ')'); // ie5-7
          n.css('-ms-filter', 'progid:DXImageTransform.Microsoft.Alpha(Opacity=' + ie + ')'); // ie8
        }
        n.css('opacity', now); // real browser
      },
      complete: function() {
        n.remove();
        self.moving = false;
      }
    });
  }
}

Carousel.prototype.setPagination = function(pagination) {
  var i = 0;
  var self = this;
  pagination.children().each(function() {
    $(this).data('_carousel_page', i++);
  }).click(function(e) {
    e.preventDefault();
    self.moveTo($(this).data('_carousel_page'));
  });
}
