var i = 1
while(lt(i, 100)) {
  if(eq(0, mod(i, 15))) {
    print("FizzBuzz\n")
  } else if(eq(0, mod(i, 3))) {
    print("Fizz\n")
  } else if(eq(0, mod(i, 5))) {
    print("Buzz\n")
  } else  {
    print (i)
  }
  ++(i)
}
